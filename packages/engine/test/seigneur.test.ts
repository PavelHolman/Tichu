import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, Random, Schema } from "effect";
import {
  bestCardValue,
  buildDeck,
  cardKey,
  seigneur,
  SeigneurEvent as SeigneurEventSchema,
  SeigneurObservation,
  type SeigneurCommand,
  type SeigneurEvent,
  type SeigneurState,
} from "../src/index.ts";
import { cards } from "./helpers.ts";

const isEvent = Schema.is(SeigneurEventSchema);
const encodeObservation = Schema.encodeUnknownSync(SeigneurObservation);

const act = (state: SeigneurState, command: SeigneurCommand) =>
  Effect.gen(function* () {
    const events = yield* seigneur.decide(state, command);
    return { events, state: seigneur.replay(events, state) };
  });

const rejected = (state: SeigneurState, command: SeigneurCommand) =>
  Effect.flip(seigneur.decide(state, command)).pipe(Effect.map((error) => error.reason));

const tags = (events: ReadonlyArray<SeigneurEvent>) => events.map((event) => event._tag);

const started = (seats: number, decks?: 1 | 2) =>
  seigneur.start({ seats, decks: decks ?? (seats >= 7 ? 2 : 1) }).pipe(
    Effect.map((events) => seigneur.replay(events)),
    Random.withSeed(`gs-${seats}`),
  );

/** A second-Round state: the hierarchy is set and the given Hands are dealt in the new play order. */
const secondRound = (hierarchy: ReadonlyArray<number>, hands: ReadonlyArray<string>) =>
  Effect.gen(function* () {
    const first = yield* started(hierarchy.length);
    return seigneur.replay(
      [
        {
          _tag: "HierarchySet",
          round: 1,
          finishingOrder: hierarchy,
        },
        {
          _tag: "CardsDealt",
          round: 2,
          order: seigneur.playOrder(hierarchy),
          hands: hands.map(cards),
        },
      ],
      first,
    );
  });

describe("Grand Seigneur deal", () => {
  it.effect("deals one Deck without the Dog to five Seats and lets the Mah Jong lead", () =>
    Effect.gen(function* () {
      const state = yield* started(5);
      const round = state.round;
      assert.isNotNull(round);
      expect(round.kernel.hands.map((hand) => hand.length)).toEqual([11, 11, 11, 11, 11]);
      const all = round.kernel.hands.flat();
      expect(all.some((card) => card._tag === "Dog")).toBe(false);
      expect(round.phase).toBe("playing");
      const holder = round.kernel.hands.findIndex((hand) =>
        hand.some((card) => card._tag === "MahJong"),
      );
      expect(round.kernel.turn).toBe(holder);
      expect(round.kernel.options).toEqual({
        quadBombNeedsDistinctSuits: true,
        laterDragonWins: true,
      });
      expect(round.kernel.dragonGift).toBe(false);
    }),
  );

  it.effect("deals two Decks without Dogs and the second Mah Jong, extra cards first", () =>
    Effect.gen(function* () {
      const state = yield* started(7);
      const hands = state.round?.kernel.hands ?? [];
      expect(hands.flat()).toHaveLength(109);
      expect(hands.map((hand) => hand.length)).toEqual([16, 16, 16, 16, 15, 15, 15]);
      expect(hands.flat().filter((card) => card._tag === "MahJong")).toHaveLength(1);
      expect(new Set(hands.flat().map(cardKey)).size).toBe(109);
    }),
  );
});

describe("hierarchy and forced Exchange", () => {
  it("plays the Great Lord, then the Wretch, then up the hierarchy", () => {
    expect(seigneur.playOrder([3, 0, 4, 1, 2])).toEqual([3, 2, 1, 4, 0]);
  });

  it("ranks the Dragon, Phoenix and Mah Jong above the Ace", () => {
    const order = cards("Dr Ph Mj Aj 2j").map(bestCardValue);
    expect(order).toEqual(order.toSorted((a, b) => b - a));
  });

  it.effect("asks the lowest ranks to give their best cards to the highest, 3/2/1", () =>
    Effect.gen(function* () {
      // Hierarchy: Seat 0 Great Lord, 1 Lord, 2 Squire, 3, 4, 5 Wretch.
      const state = yield* secondRound(
        [0, 1, 2, 3, 4, 5],
        ["2j 3j", "2s 3s", "2p 3p", "4j 5j", "Aj As 9p 9t 4s", "Dr Kj Ks Kp 5s"],
      );
      expect(state.round?.phase).toBe("giving");
      const decisions = seigneur.pendingDecisions(state);
      expect(
        decisions.map(
          (decision) =>
            decision._tag === "ForcedGive" && [decision.seat, decision.to, decision.count],
        ),
      ).toEqual([
        [5, 0, 3],
        [4, 1, 2],
        [3, 2, 1],
      ]);
      const wretch = decisions[0];
      assert(wretch?._tag === "ForcedGive");
      expect(wretch.suggested.map(bestCardValue).toSorted()).toEqual(
        cards("Dr Kj Ks").map(bestCardValue).toSorted(),
      );

      expect(yield* rejected(state, { _tag: "GiveBest", seat: 5, cards: cards("Dr Kj 5s") })).toBe(
        "InvalidExchange",
      );
      expect(yield* rejected(state, { _tag: "GiveBest", seat: 0, cards: cards("2j") })).toBe(
        "NotYourTurn",
      );
      // Any two of the equal Kings are fine.
      const gave = yield* act(state, { _tag: "GiveBest", seat: 5, cards: cards("Dr Ks Kp") });
      expect(tags(gave.events)).toEqual(["BestCardsGiven"]);
      expect(seigneur.redact(gave.events[0] as SeigneurEvent, 0)).toMatchObject({ cards: [] });
    }),
  );

  it.effect(
    "reveals the gifts, lets the recipients return any cards after seeing them, then plays",
    () =>
      Effect.gen(function* () {
        let state = yield* secondRound(
          [0, 1, 2, 3, 4],
          ["2j 3j Mj", "2s 3s", "2p 3p", "Aj As 9p 4s", "Dr Kj Ks 5s"],
        );
        const decisions = seigneur.pendingDecisions(state);
        expect(
          decisions.map((decision) => decision._tag === "ForcedGive" && decision.count),
        ).toEqual([2, 1]);
        state = (yield* act(state, { _tag: "GiveBest", seat: 4, cards: cards("Dr Kj") })).state;
        const revealed = yield* act(state, { _tag: "GiveBest", seat: 3, cards: cards("Aj") });
        expect(tags(revealed.events)).toEqual(["BestCardsGiven", "GiftsRevealed"]);
        state = revealed.state;
        expect(state.round?.kernel.hands[0]?.map(cardKey)).toEqual(
          cards("2j 3j Mj Dr Kj").map(cardKey),
        );

        const returns = seigneur.pendingDecisions(state);
        expect(
          returns.map(
            (decision) =>
              decision._tag === "ReturnCards" && [decision.seat, decision.to, decision.count],
          ),
        ).toEqual([
          [0, 4, 2],
          [1, 3, 1],
        ]);
        expect(yield* rejected(state, { _tag: "ReturnCards", seat: 0, cards: cards("2j") })).toBe(
          "InvalidExchange",
        );
        state = (yield* act(state, { _tag: "ReturnCards", seat: 0, cards: cards("2j Dr") })).state;
        const done = yield* act(state, { _tag: "ReturnCards", seat: 1, cards: cards("3s") });
        expect(tags(done.events)).toEqual(["CardsReturned", "ReturnsRevealed"]);
        const hands = done.state.round?.kernel.hands ?? [];
        expect(hands.map((hand) => hand.length)).toEqual([3, 2, 2, 4, 4]);
        expect(done.state.round?.phase).toBe("playing");
        expect(done.state.round?.kernel.turn).toBe(0);
      }),
  );

  it.effect(
    "ends the Round when one Seat holds cards and sets the hierarchy from the finishing order",
    () =>
      Effect.gen(function* () {
        const base = yield* started(5);
        const hands = [["Mj"], ["3j 4j"], ["5j"], ["6j"], ["2s"]].map((spec) =>
          cards(spec[0] ?? ""),
        );
        const round = base.round;
        assert.isNotNull(round);
        let state: SeigneurState = {
          ...base,
          round: { ...round, kernel: { ...round.kernel, hands, turn: 0 } },
        };
        const commands: Array<SeigneurCommand> = [
          { _tag: "Play", seat: 0, cards: cards("Mj") },
          { _tag: "Play", seat: 1, cards: cards("3j") },
          { _tag: "Play", seat: 2, cards: cards("5j") },
          { _tag: "Play", seat: 3, cards: cards("6j") },
          { _tag: "Pass", seat: 4 },
          { _tag: "Pass", seat: 1 },
          { _tag: "Play", seat: 4, cards: cards("2s") },
        ];
        const events: Array<SeigneurEvent> = [];
        for (const command of commands) {
          const result = yield* act(state, command);
          events.push(...result.events);
          state = result.state;
        }
        const ended = events.find((event) => event._tag === "HierarchySet");
        assert(ended?._tag === "HierarchySet");
        expect(ended.finishingOrder).toEqual([0, 2, 3, 4, 1]);
        expect(tags(events).at(-1)).toBe("CardsDealt");
        expect(state.hierarchy).toEqual([0, 2, 3, 4, 1]);
        expect(state.round?.kernel.order).toEqual([0, 1, 4, 3, 2]);
        expect(state.round?.phase).toBe("giving");
      }),
  );
});

describe("random Grand Seigneur Rounds", () => {
  it.effect(
    "keep every card and accept every legal choice, from five to twelve Seats",
    () =>
      Effect.gen(function* () {
        for (const seats of [5, 6, 7, 9, 12]) {
          for (const decks of [1, 2] as const) {
            let state = seigneur.replay(yield* seigneur.start({ seats, decks }));
            const deckSize = buildDeck({ copies: decks, withDog: false, mahJongs: 1 }).length;
            let rounds = 0;
            for (let step = 0; step < 6_000 && rounds < 3; step++) {
              const decision = (yield* Random.shuffle(seigneur.pendingDecisions(state)))[0];
              assert.isDefined(decision, `${seats} Seats: the engine waits on someone`);
              const hand = state.round?.kernel.hands[decision.seat] ?? [];
              let command: SeigneurCommand;
              switch (decision._tag) {
                case "ForcedGive":
                  command = { _tag: "GiveBest", seat: decision.seat, cards: decision.suggested };
                  break;
                case "ReturnCards":
                  command = {
                    _tag: "ReturnCards",
                    seat: decision.seat,
                    cards: (yield* Random.shuffle(hand)).slice(0, decision.count),
                  };
                  break;
                case "Play": {
                  const index = yield* Random.nextIntBetween(
                    0,
                    decision.plays.length - (decision.canPass ? 0 : 1),
                  );
                  const option = decision.plays[index];
                  command =
                    option === undefined
                      ? { _tag: "Pass", seat: decision.seat }
                      : {
                          _tag: "Play",
                          seat: decision.seat,
                          cards: option.cards,
                          ...(option.phoenixAs === undefined
                            ? {}
                            : { phoenixAs: option.phoenixAs }),
                        };
                  break;
                }
              }
              const events = yield* seigneur.decide(state, command).pipe(Effect.orDie);
              for (const event of events) {
                assert.isTrue(isEvent(event), event._tag);
                if (event._tag === "HierarchySet") rounds++;
                state = seigneur.evolve(state, event);
              }
              const kernel = state.round?.kernel;
              if (kernel !== undefined && state.round?.phase === "playing") {
                const count =
                  kernel.hands.flat().length +
                  kernel.won.flat().length +
                  kernel.trick.flatMap((entry) => (entry._tag === "Play" ? entry.cards : []))
                    .length;
                expect(count).toBe(deckSize);
              }
              encodeObservation(seigneur.observe(state, decision.seat));
            }
            expect(rounds, `${seats} Seats, ${decks} Decks`).toBe(3);
          }
        }
      }).pipe(Random.withSeed("gs-random")),
    120_000,
  );
});
