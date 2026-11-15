import { describe, expect, it } from "@effect/vitest";
import { Effect, Random, Schema } from "effect";
import { GameEvent, Observation, game, seatsFor, type GameSettings } from "../src/index.ts";

const settings: ReadonlyArray<GameSettings> = [
  { _tag: "Standard", match: { targetScore: 1000 } },
  { _tag: "GrandSeigneur", match: { seats: 8, decks: 2 } },
];

describe("game", () => {
  it.effect.each(settings)(
    "starts, observes and round-trips a $_tag Match through its schemas",
    (chosen) =>
      Effect.gen(function* () {
        const events = yield* game.start(chosen);
        const encoded = events.map((event) => Schema.encodeSync(GameEvent)(event));
        const decoded = encoded.map((event) => Schema.decodeUnknownSync(GameEvent)(event));
        const state = game.replay(decoded);
        expect(state.variant).toBe(chosen._tag === "Standard" ? "standard" : "grandSeigneur");
        expect(state.layout.seats).toBe(seatsFor(chosen));
        const observation = game.observe(state, 0);
        expect(
          Schema.decodeUnknownSync(Observation)(Schema.encodeSync(Observation)(observation)),
        ).toEqual(observation);
        expect(game.pendingDecisions(state).length).toBeGreaterThan(0);
        expect(game.isOver(state)).toBe(false);
      }).pipe(Random.withSeed("game")),
  );

  it.effect("rejects a command from another Variant", () =>
    Effect.gen(function* () {
      const state = game.replay(yield* game.start(settings[1]!));
      const error = yield* Effect.flip(game.decide(state, { _tag: "CallTichu", seat: 0 }));
      expect(error.reason).toBe("WrongPhase");
    }),
  );
});
