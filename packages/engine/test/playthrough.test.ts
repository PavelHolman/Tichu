import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, Random, Schema } from "effect";
import {
  StandardObservation,
  StandardEvent,
  decide,
  emptyStandardState,
  evolve,
  observe,
  pendingDecisions,
  reactions,
  replay,
  start,
  type StandardDecision,
  type StandardCommand,
  type StandardEvent as StandardEventType,
  type StandardState,
  WISH_RANKS,
} from "../src/index.ts";

const pick = <A>(items: ReadonlyArray<A>) =>
  Effect.gen(function* () {
    const index = yield* Random.nextIntBetween(0, items.length - 1);
    return items[index] as A;
  });

const answer = (state: StandardState, decision: StandardDecision) =>
  Effect.gen(function* () {
    switch (decision._tag) {
      case "GrandTichu":
        return {
          _tag: "GrandTichu",
          seat: decision.seat,
          call: (yield* Random.next) < 0.1,
        } as const;
      case "Exchange": {
        const hand = yield* Random.shuffle(state.round?.kernel.hands[decision.seat] ?? []);
        return {
          _tag: "Exchange",
          seat: decision.seat,
          gives: decision.to.map((to, index) => ({ to, card: hand[index]! })),
        } as const;
      }
      case "Play": {
        const count = decision.plays.length + (decision.canPass ? 1 : 0);
        const index = yield* Random.nextIntBetween(0, count - 1);
        const option = decision.plays[index];
        if (option === undefined) return { _tag: "Pass", seat: decision.seat } as const;
        const hasMahJong = option.cards.some((card) => card._tag === "MahJong");
        const wish =
          hasMahJong && (yield* Random.nextBoolean) ? yield* pick(WISH_RANKS) : undefined;
        return {
          _tag: "Play",
          seat: decision.seat,
          cards: option.cards,
          ...(option.phoenixAs === undefined ? {} : { phoenixAs: option.phoenixAs }),
          ...(wish === undefined ? {} : { wish }),
        } as const;
      }
      case "DragonGift":
        return { _tag: "GiftDragon", seat: decision.seat, to: yield* pick(decision.to) } as const;
    }
  });

/** Occasionally volunteers a Reaction from a random Seat. */
const maybeReact = (state: StandardState) =>
  Effect.gen(function* () {
    if ((yield* Random.next) > 0.15) return undefined;
    const seat = yield* Random.nextIntBetween(0, 3);
    const available = reactions(state, seat);
    if (available.bombs.length > 0 && (yield* Random.nextBoolean)) {
      const bomb = yield* pick(available.bombs);
      return { _tag: "Play", seat, cards: bomb.cards } satisfies StandardCommand;
    }
    if (available.callTichu && (yield* Random.next) < 0.2) {
      return { _tag: "CallTichu", seat } satisfies StandardCommand;
    }
    return undefined;
  });

const cardsInPlay = (state: StandardState): number => {
  const kernel = state.round?.kernel;
  if (kernel === undefined || state.round?.phase !== "playing") return 56;
  const inHands = kernel.hands.reduce((total, hand) => total + hand.length, 0);
  const won = kernel.won.reduce((total, cards) => total + cards.length, 0);
  const onTrick = kernel.trick.reduce(
    (total, entry) => total + (entry._tag === "Play" ? entry.cards.length : 0),
    0,
  );
  return inHands + won + onTrick + (kernel.pendingGift?.cards.length ?? 0);
};

const isEvent = Schema.is(StandardEvent);
const encodeObservation = Schema.encodeUnknownSync(StandardObservation);

const playMatch = (seed: string) =>
  Effect.gen(function* () {
    const log: Array<StandardEventType> = [...(yield* start({ targetScore: 400 }))];
    let state = replay(log);
    let rounds = 0;
    for (let step = 0; step < 20_000 && state.winningTeam === null; step++) {
      const reaction = yield* maybeReact(state);
      const decisions = pendingDecisions(state);
      assert.isAbove(decisions.length, 0, "the engine is always waiting on someone");
      const command = reaction ?? (yield* answer(state, yield* pick(decisions)));
      const events = yield* decide(state, command).pipe(
        Effect.mapError(
          (error) =>
            new Error(`${seed} step ${step}: ${error.message}: ${JSON.stringify(command)}`),
        ),
        Effect.orDie,
      );
      for (const event of events) {
        assert.isTrue(isEvent(event), `event matches its schema: ${event._tag}`);
        if (event._tag === "RoundEnded") {
          rounds++;
          if (!event.oneTwo) expect(event.cardPoints.reduce((a, b) => a + b, 0)).toBe(100);
        }
        state = evolve(state, event);
        log.push(event);
        assert.strictEqual(cardsInPlay(state), 56, "every card is accounted for");
      }
      if (step % 50 === 0)
        for (let seat = 0; seat < 4; seat++) encodeObservation(observe(state, seat));
    }
    assert.isNotNull(state.winningTeam, "the Match ends");
    expect(replay(log, emptyStandardState)).toEqual(state);
    return rounds;
  }).pipe(Random.withSeed(seed));

describe("random playthroughs", () => {
  it.effect(
    "play whole Matches with legal choices and random Reactions",
    () =>
      Effect.gen(function* () {
        let rounds = 0;
        for (let seed = 0; seed < 12; seed++) rounds += yield* playMatch(`match-${seed}`);
        assert.isAbove(rounds, 12);
      }),
    60_000,
  );
});
