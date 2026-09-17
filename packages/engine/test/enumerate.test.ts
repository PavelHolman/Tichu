import { assert, describe, expect, it } from "@effect/vitest";
import { Effect, Random, Schema } from "effect";
import {
  buildDeck,
  cardKey,
  classify,
  combinationsInHand,
  standardDeck,
  standardKernelOptions,
  type Card,
  type PlayCards,
} from "../src/index.ts";
import { cards } from "./helpers.ts";

const playKey = (play: PlayCards) =>
  `${play.cards.map(cardKey).toSorted().join(",")}|${play.phoenixAs ?? ""}`;

/** Every subset of the Hand with every Phoenix rank, classified on a lead. */
const bruteForce = (hand: ReadonlyArray<Card>): Set<string> => {
  const found = new Set<string>();
  for (let mask = 1; mask < 1 << hand.length; mask++) {
    const subset = hand.filter((_, index) => (mask & (1 << index)) !== 0);
    const hasPhoenix = subset.some((card) => card._tag === "Phoenix");
    const phoenixRanks =
      hasPhoenix && subset.length > 1 ? [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] : [undefined];
    for (const phoenixAs of phoenixRanks) {
      const play: PlayCards =
        phoenixAs === undefined ? { cards: subset } : { cards: subset, phoenixAs };
      if (classify(play, undefined) !== undefined) found.add(playKey(play));
    }
  }
  return found;
};

describe("combinationsInHand", () => {
  it("lists singles, pairs and the triple of three of a kind", () => {
    const types = combinationsInHand(cards("7j 7s 7p")).map((option) => option.combination.type);
    expect(types.filter((type) => type === "single")).toHaveLength(3);
    expect(types.filter((type) => type === "pair")).toHaveLength(3);
    expect(types.filter((type) => type === "triple")).toHaveLength(1);
  });

  it("lets the Phoenix extend a run at either end", () => {
    const straights = combinationsInHand(cards("5j 6s 7j 8s Ph")).filter(
      (option) => option.combination.type === "straight",
    );
    expect(straights.map((option) => option.phoenixAs).toSorted()).toEqual([4, 9]);
  });

  it("lists a same-suit run as a Bomb and never as a straight", () => {
    const options = combinationsInHand(cards("3j 4j 5j 6j 7j"));
    expect(options.filter((option) => option.combination.type === "bomb")).toHaveLength(1);
    expect(options.filter((option) => option.combination.type === "straight")).toHaveLength(0);
  });

  it.effect("matches brute force on random nine-card Hands", () =>
    Effect.gen(function* () {
      const deck = buildDeck(standardDeck);
      for (let round = 0; round < 300; round++) {
        const hand = (yield* Random.shuffle(deck)).slice(0, 9);
        const enumerated = combinationsInHand(hand).map(playKey);
        assert.strictEqual(new Set(enumerated).size, enumerated.length, "no duplicates");
        expect(new Set(enumerated)).toEqual(bruteForce(hand));
      }
    }).pipe(Random.withSeed("enumerate")),
  );

  it.effect.prop(
    "classifies every option as the Combination it reports",
    { indices: Schema.Array(Schema.Int.check(Schema.isBetween({ minimum: 0, maximum: 55 }))) },
    ({ indices }) =>
      Effect.sync(() => {
        const deck = buildDeck(standardDeck);
        const hand = [...new Set(indices)].slice(0, 14).map((index) => deck[index] as Card);
        for (const option of combinationsInHand(hand)) {
          expect(classify(option, undefined, standardKernelOptions)).toEqual(option.combination);
        }
      }),
  );
});
