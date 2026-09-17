import { assert, describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import {
  buildDeck,
  decide,
  emptyStandardState,
  makeKernel,
  observe,
  pendingDecisions,
  reactions,
  redact,
  replay,
  sortCards,
  standardDeck,
  standardKernelOptions,
  type CallKind,
  type Card,
  type Seat,
  type StandardCommand,
  type StandardEvent,
  type StandardState,
} from "../src/index.ts";
import { cards } from "./helpers.ts";

const act = (state: StandardState, command: StandardCommand) =>
  Effect.gen(function* () {
    const events = yield* decide(state, command);
    return { events, state: replay(events, state) };
  });

const rejected = (state: StandardState, command: StandardCommand) =>
  Effect.flip(decide(state, command)).pipe(Effect.map((error) => error.reason));

const tags = (events: ReadonlyArray<StandardEvent>) => events.map((event) => event._tag);

/** A Round already in play with the given Hands (any size), skipping the deal and Exchange. */
const inPlay = (options: {
  readonly hands: ReadonlyArray<string>;
  readonly turn: Seat;
  readonly calls?: ReadonlyArray<CallKind>;
  readonly totals?: ReadonlyArray<number>;
  readonly targetScore?: number;
  readonly wish?: number;
  readonly finished?: ReadonlyArray<Seat>;
}): StandardState => {
  const hands = options.hands.map(cards);
  return {
    ...emptyStandardState,
    settings: { targetScore: options.targetScore ?? 1000 },
    totals: options.totals ?? [0, 0],
    round: {
      number: 1,
      phase: "playing",
      dealt: hands,
      grandTichu: hands.map(() => false),
      calls: options.calls ?? hands.map(() => "none"),
      exchanges: hands.map(() => []),
      kernel: {
        ...makeKernel({
          layout: emptyStandardState.layout,
          options: standardKernelOptions,
          dragonGift: true,
          hands,
          turn: options.turn,
        }),
        wish: options.wish ?? null,
        finished: options.finished ?? [],
      },
    },
  };
};

const play = (seat: Seat, spec: string, extra: { phoenixAs?: number; wish?: number } = {}) =>
  ({ _tag: "Play", seat, cards: cards(spec), ...extra }) as const;
const pass = (seat: Seat) => ({ _tag: "Pass", seat }) as const;

/** Applies commands in order, failing the test on the first rejection. */
const actAll = (state: StandardState, commands: ReadonlyArray<StandardCommand>) =>
  Effect.gen(function* () {
    let current = state;
    const events: Array<StandardEvent> = [];
    for (const command of commands) {
      const result = yield* act(current, command);
      current = result.state;
      events.push(...result.events);
    }
    return { state: current, events };
  });

describe("deal, Grand Tichu and Exchange", () => {
  const deck = buildDeck(standardDeck);
  const hands = [0, 1, 2, 3].map((seat) => deck.slice(seat * 14, (seat + 1) * 14));
  const dealt = replay([
    { _tag: "MatchStarted", layout: emptyStandardState.layout, settings: { targetScore: 1000 } },
    { _tag: "RoundDealt", round: 1, hands },
  ]);

  it("shows eight cards and asks every Seat for Grand Tichu", () => {
    expect(observe(dealt, 0).round?.hand).toHaveLength(8);
    expect(pendingDecisions(dealt).map((decision) => decision._tag)).toEqual([
      "GrandTichu",
      "GrandTichu",
      "GrandTichu",
      "GrandTichu",
    ]);
    expect(reactions(dealt, 0).callTichu).toBe(false);
  });

  it.effect("keeps Grand Tichu answers private until every Seat decided", () =>
    Effect.gen(function* () {
      const first = yield* act(dealt, { _tag: "GrandTichu", seat: 1, call: true });
      expect(observe(first.state, 0).round?.calls).toEqual(["none", "none", "none", "none"]);
      expect(observe(first.state, 1).round?.calls[1]).toBe("grandTichu");
      const [decided] = first.events;
      assert.isDefined(decided);
      expect(redact(decided, 0)).toMatchObject({ seat: 1, call: false });
      expect(yield* rejected(first.state, { _tag: "GrandTichu", seat: 1, call: false })).toBe(
        "AlreadyDecided",
      );

      const all = yield* actAll(first.state, [
        { _tag: "GrandTichu", seat: 0, call: false },
        { _tag: "GrandTichu", seat: 2, call: false },
        { _tag: "GrandTichu", seat: 3, call: false },
      ]);
      expect(tags(all.events).at(-1)).toBe("RemainingCardsDealt");
      expect(observe(all.state, 0).round?.calls).toEqual(["none", "grandTichu", "none", "none"]);
      expect(observe(all.state, 0).round?.hand).toHaveLength(14);
      expect(reactions(all.state, 1).callTichu).toBe(false);
    }),
  );

  it.effect("exchanges atomically and hands the lead to the Mah Jong holder", () =>
    Effect.gen(function* () {
      const exchanging = (yield* actAll(dealt, [
        { _tag: "GrandTichu", seat: 0, call: false },
        { _tag: "GrandTichu", seat: 1, call: false },
        { _tag: "GrandTichu", seat: 2, call: false },
        { _tag: "GrandTichu", seat: 3, call: false },
      ])).state;
      const give = (seat: Seat) => {
        const hand = hands[seat] ?? [];
        return {
          _tag: "Exchange",
          seat,
          gives: [1, 2, 3].map((offset, index) => ({
            to: (seat + offset) % 4,
            card: hand[index] as Card,
          })),
        } as const;
      };

      expect(
        yield* rejected(exchanging, {
          _tag: "Exchange",
          seat: 0,
          gives: [
            { to: 1, card: hands[0]?.[0] as Card },
            { to: 1, card: hands[0]?.[1] as Card },
            { to: 2, card: hands[0]?.[2] as Card },
          ],
        }),
      ).toBe("InvalidExchange");
      expect(
        yield* rejected(exchanging, {
          ...give(0),
          gives: [{ to: 1, card: hands[1]?.[0] as Card }, ...give(0).gives.slice(1)],
        }),
      ).toBe("InvalidExchange");

      const called = yield* act(exchanging, { _tag: "CallTichu", seat: 0 });
      const submitted = yield* act(called.state, give(0));
      expect(observe(submitted.state, 1).round?.decided).toEqual([true, false, false, false]);
      expect(redact(submitted.events[0] as StandardEvent, 1)).toMatchObject({ gives: [] });
      expect(yield* rejected(submitted.state, { _tag: "CallTichu", seat: 0 })).toBe(
        "CallNotAllowed",
      );

      const done = yield* actAll(submitted.state, [give(1), give(2), give(3)]);
      expect(tags(done.events).at(-1)).toBe("ExchangeCompleted");
      const observation = observe(done.state, 1).round;
      expect(observation?.hand).toHaveLength(14);
      expect(observation?.received.map((entry) => entry.from).toSorted()).toEqual([0, 2, 3]);
      const holder = [0, 1, 2, 3].find((seat) =>
        observe(done.state, seat).round?.hand.some((card) => card._tag === "MahJong"),
      );
      expect(observation?.turn).toBe(holder);
      expect(reactions(done.state, 1).callTichu).toBe(true);
    }),
  );
});

describe("Tricks", () => {
  it.effect("closes a Trick when every other holder passed and gives the lead to its winner", () =>
    Effect.gen(function* () {
      const state = inPlay({ hands: ["3j 9j", "5s 2s", "7p 2p", "4t 2t"], turn: 0 });
      expect(yield* rejected(state, pass(0))).toBe("PassNotAllowed");
      expect(yield* rejected(state, play(1, "5s"))).toBe("NotYourTurn");
      const result = yield* actAll(state, [play(0, "3j"), play(1, "5s"), pass(2), pass(3)]);
      expect(tags(result.events).at(-1)).toBe("Passed");
      const closed = yield* act(result.state, pass(0));
      expect(tags(closed.events)).toEqual(["Passed", "TrickWon"]);
      expect(observe(closed.state, 0).round?.turn).toBe(1);
      expect(observe(closed.state, 0).round?.wonCounts).toEqual([0, 2, 0, 0]);
    }),
  );

  it.effect("lets a Passer re-enter the Trick", () =>
    Effect.gen(function* () {
      const state = inPlay({ hands: ["3j 9j", "5s 2s", "7p 2p", "4t 2t"], turn: 0 });
      const result = yield* actAll(state, [
        play(0, "3j"),
        pass(1),
        play(2, "7p"),
        pass(3),
        play(0, "9j"),
      ]);
      expect(observe(result.state, 0).round?.turn).toBe(1);
    }),
  );

  it.effect("rejects a Play that does not beat the Trick", () =>
    Effect.gen(function* () {
      const state = inPlay({ hands: ["8j 9j", "5s 5j", "7p 2p", "4t 2t"], turn: 0 });
      const led = yield* act(state, play(0, "8j"));
      expect(yield* rejected(led.state, play(1, "5s"))).toBe("DoesNotBeat");
      expect(yield* rejected(led.state, play(1, "5s 5j"))).toBe("DoesNotBeat");
      expect(yield* rejected(led.state, play(1, "7p"))).toBe("CardsNotInHand");
    }),
  );

  it.effect("skips Seats that are out and passes the lead on when the winner is out", () =>
    Effect.gen(function* () {
      const state = inPlay({ hands: ["Aj", "5s 2s", "7p 2p", "4t 2t"], turn: 0 });
      const out = yield* act(state, play(0, "Aj"));
      expect(tags(out.events)).toEqual(["Played", "SeatFinished"]);
      const closed = yield* actAll(out.state, [pass(1), pass(2), pass(3)]);
      expect(tags(closed.events).slice(-2)).toEqual(["Passed", "TrickWon"]);
      expect(observe(closed.state, 1).round?.turn).toBe(1);
      expect(observe(closed.state, 1).round?.wonCounts[0]).toBe(1);
    }),
  );

  it.effect("passes the lead to the partner with the Dog, or on from the partner if out", () =>
    Effect.gen(function* () {
      const withPartner = yield* act(
        inPlay({ hands: ["Dg 3j", "5s", "7p", "4t"], turn: 0 }),
        play(0, "Dg"),
      );
      expect(observe(withPartner.state, 0).round?.turn).toBe(2);
      expect(observe(withPartner.state, 0).round?.trick).toEqual([]);

      const partnerOut = inPlay({ hands: ["Dg 3j", "5s", "", "4t"], turn: 0 });
      const passed = yield* act(partnerOut, play(0, "Dg"));
      expect(observe(passed.state, 0).round?.turn).toBe(3);
    }),
  );

  it.effect("lets a Seat off turn Bomb an open Trick but never an empty one", () =>
    Effect.gen(function* () {
      const state = inPlay({ hands: ["Kj 3j", "7p 2s", "5s 5j 5p 5t 2p", "4t"], turn: 0 });
      expect(yield* rejected(state, play(2, "5s 5j 5p 5t"))).toBe("NotYourTurn");
      const led = yield* act(state, play(0, "Kj"));
      expect(reactions(led.state, 2).bombs).toHaveLength(1);
      expect(reactions(led.state, 1).bombs).toHaveLength(0);
      expect(yield* rejected(led.state, play(3, "4t"))).toBe("NotYourTurn");
      const bombed = yield* act(led.state, play(2, "5s 5j 5p 5t"));
      expect(observe(bombed.state, 0).round?.turn).toBe(3);
    }),
  );
});

describe("Wish", () => {
  it.effect("forces the wished rank when a legal Play contains it, and forbids passing", () =>
    Effect.gen(function* () {
      const state = inPlay({ hands: ["Mj 3j", "8s 9s", "8p 2p", "4t 2t"], turn: 0 });
      const wished = yield* act(state, play(0, "Mj", { wish: 8 }));
      expect(observe(wished.state, 1).round?.wish).toBe(8);
      expect(yield* rejected(wished.state, pass(1))).toBe("WishNotHonoured");
      expect(yield* rejected(wished.state, play(1, "9s"))).toBe("WishNotHonoured");
      const decision = pendingDecisions(wished.state)[0];
      assert(decision?._tag === "Play");
      expect(decision.plays.map((option) => option.cards)).toEqual([cards("8s")]);
      expect(decision.canPass).toBe(false);

      const fulfilled = yield* act(wished.state, play(1, "8s"));
      expect(observe(fulfilled.state, 1).round?.wish).toBeNull();
    }),
  );

  it.effect("does not bind a Seat that cannot lay the rank, nor count the Phoenix", () =>
    Effect.gen(function* () {
      const state = inPlay({ hands: ["Mj 3j", "Ph 9s", "8p 2p", "4t 2t"], turn: 0 });
      const wished = yield* act(state, play(0, "Mj", { wish: 8 }));
      yield* act(wished.state, pass(1));
    }),
  );

  it.effect("binds a lead and forbids the Dog while a lead with the rank exists", () =>
    Effect.gen(function* () {
      const state = inPlay({ hands: ["2j", "2s", "Dg 8p 3p", "4t"], turn: 2, wish: 8 });
      expect(yield* rejected(state, play(2, "Dg"))).toBe("WishNotHonoured");
      expect(yield* rejected(state, play(2, "3p"))).toBe("WishNotHonoured");
      yield* act(state, play(2, "8p"));
    }),
  );

  it.effect("rejects a Wish without the Mah Jong", () =>
    Effect.gen(function* () {
      const state = inPlay({ hands: ["3j 4j", "8s", "8p", "4t"], turn: 0 });
      expect(yield* rejected(state, play(0, "3j", { wish: 8 }))).toBe("InvalidWish");
    }),
  );

  it.effect("lets an out-of-turn Bomb ignore the Wish", () =>
    Effect.gen(function* () {
      const state = inPlay({ hands: ["Mj 3j", "2s", "8p 5s 5j 5p 5t", "4t"], turn: 0 });
      const wished = yield* act(state, play(0, "Mj", { wish: 8 }));
      yield* act(wished.state, play(2, "5s 5j 5p 5t"));
    }),
  );
});

describe("Dragon Gift", () => {
  it.effect("asks the Dragon's winner to give the Trick to an opponent, then lets it lead", () =>
    Effect.gen(function* () {
      const state = inPlay({ hands: ["Dr 3j", "Ks 2s", "7p 2p", "4t 2t"], turn: 1 });
      const won = yield* actAll(state, [
        play(1, "Ks"),
        pass(2),
        pass(3),
        play(0, "Dr"),
        pass(1),
        pass(2),
        pass(3),
      ]);
      const decision = pendingDecisions(won.state)[0];
      assert(decision?._tag === "DragonGift");
      expect(decision.to).toEqual([1, 3]);
      expect(yield* rejected(won.state, play(0, "3j"))).toBe("WrongPhase");
      expect(yield* rejected(won.state, { _tag: "GiftDragon", seat: 0, to: 2 })).toBe(
        "InvalidRecipient",
      );
      const given = yield* act(won.state, { _tag: "GiftDragon", seat: 0, to: 3 });
      const round = observe(given.state, 0).round;
      expect(round?.wonCounts).toEqual([0, 0, 0, 2]);
      expect(round?.turn).toBe(0);
    }),
  );

  it.effect("keeps a bombed Dragon Trick with the bomber", () =>
    Effect.gen(function* () {
      const state = inPlay({ hands: ["Dr 3j", "9s 9j 9p 9t 2s", "7p 2p", "4t 2t"], turn: 0 });
      const result = yield* actAll(state, [
        play(0, "Dr"),
        play(1, "9s 9j 9p 9t"),
        pass(2),
        pass(3),
        pass(0),
      ]);
      expect(pendingDecisions(result.state)[0]?._tag).toBe("Play");
      expect(observe(result.state, 0).round?.wonCounts).toEqual([0, 5, 0, 0]);
    }),
  );
});

describe("Round end and scoring", () => {
  it.effect("ends a one-two at once with 200 and the Calls", () =>
    Effect.gen(function* () {
      const state = inPlay({
        hands: ["Aj", "3s 2s", "Dr", "4t 2t"],
        turn: 0,
        calls: ["none", "tichu", "tichu", "none"],
      });
      const result = yield* actAll(state, [play(0, "Aj"), pass(1), play(2, "Dr")]);
      const ended = result.events.find((event) => event._tag === "RoundEnded");
      assert(ended?._tag === "RoundEnded");
      expect(ended.oneTwo).toBe(true);
      expect(ended.cardPoints).toEqual([200, 0]);
      expect(ended.points).toEqual([100, -100]);
      expect(tags(result.events).at(-1)).toBe("RoundDealt");
      expect(observe(result.state, 0).round?.number).toBe(2);
    }),
  );

  it.effect("gives the tailender's Hand to the opponents and Tricks to the first out", () =>
    Effect.gen(function* () {
      const state = inPlay({ hands: ["Kj", "10s", "5p", "Kt 10t 5t Ph Dr"], turn: 0 });
      const result = yield* actAll(state, [play(0, "Kj"), pass(1), pass(2), pass(3)]);
      // Seat 0 is out holding K; seat 1 leads.
      const rest = yield* actAll(result.state, [play(1, "10s"), pass(2), pass(3)]);
      const final = yield* act(rest.state, play(2, "5p"));
      const ended = final.events.find((event) => event._tag === "RoundEnded");
      assert(ended?._tag === "RoundEnded");
      expect(ended.finishingOrder).toEqual([0, 1, 2, 3]);
      // Team 0 (Seats 0, 2): K + 5 from Tricks. Team 1: 10 won, plus the tailender's Hand (to team 0).
      expect(ended.cardPoints).toEqual([10 + 5 + 10 + 10 + 5 - 25 + 25, 10]);
    }),
  );

  it.effect("waits for the Dragon Gift on the Round-ending Trick", () =>
    Effect.gen(function* () {
      const state = inPlay({ hands: ["", "", "Dr", "4t 5t"], turn: 2, finished: [0, 1] });
      const last = yield* act(state, play(2, "Dr"));
      expect(tags(last.events)).toEqual(["Played", "SeatFinished", "TrickWon"]);
      expect(pendingDecisions(last.state)[0]?._tag).toBe("DragonGift");
      const given = yield* act(last.state, { _tag: "GiftDragon", seat: 2, to: 3 });
      expect(tags(given.events).slice(0, 2)).toEqual(["DragonGiven", "RoundEnded"]);
    }),
  );

  it.effect("ends the Match when a Team reaches the target, playing on through a tie", () =>
    Effect.gen(function* () {
      const tied = inPlay({
        hands: ["Aj", "3s 2s", "Dr", "4t 2t"],
        turn: 0,
        totals: [900, 1100],
        targetScore: 1000,
      });
      const tie = yield* actAll(tied, [play(0, "Aj"), pass(1), play(2, "Dr")]);
      expect(tags(tie.events)).not.toContain("MatchEnded");

      const winning = inPlay({ hands: ["Aj", "3s 2s", "Dr", "4t 2t"], turn: 0, totals: [900, 0] });
      const won = yield* actAll(winning, [play(0, "Aj"), pass(1), play(2, "Dr")]);
      expect(tags(won.events).at(-1)).toBe("MatchEnded");
      expect(yield* rejected(won.state, pass(1))).toBe("MatchOver");
    }),
  );
});

describe("sorting", () => {
  it("sorts a Hand low to high with the specials at the ends", () => {
    expect(sortCards(cards("Dr 5j Mj Ph 2s Dg"))).toEqual(cards("Dg Mj 2s 5j Ph Dr"));
  });
});
