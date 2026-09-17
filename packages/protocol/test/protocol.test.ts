import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { decodeClientMessage, encodeServerMessage, decodeServerMessage } from "../src/index.ts";

describe("protocol", () => {
  it.effect("decodes a Decision answer carrying an engine command", () =>
    Effect.gen(function* () {
      const message = yield* decodeClientMessage(
        JSON.stringify({
          _tag: "Answer",
          decisionId: "play:1:4",
          command: {
            _tag: "Play",
            seat: 2,
            cards: [{ _tag: "Normal", suit: "jade", rank: 7, copy: 0 }],
          },
        }),
      );
      expect(message._tag).toBe("Answer");
    }),
  );

  it.effect("rejects malformed messages", () =>
    Effect.gen(function* () {
      const bad = yield* Effect.flip(
        decodeClientMessage(JSON.stringify({ _tag: "Answer", decisionId: 3, command: {} })),
      );
      expect(bad._tag).toBe("SchemaError");
      yield* Effect.flip(decodeClientMessage("not json"));
    }),
  );

  it.effect("round-trips a server rejection", () =>
    Effect.gen(function* () {
      const text = yield* encodeServerMessage({
        _tag: "Rejected",
        reason: "StaleDecision",
        message: "x",
      });
      expect(yield* decodeServerMessage(text)).toEqual({
        _tag: "Rejected",
        reason: "StaleDecision",
        message: "x",
      });
    }),
  );
});
