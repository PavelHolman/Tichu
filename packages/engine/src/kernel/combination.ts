import { Schema } from "effect";
import { Card, DRAGON_RANK, MAH_JONG_RANK, Rank, type NormalCard } from "./cards.ts";

export const CombinationType = Schema.Literals([
  "single",
  "pair",
  "triple",
  "fullHouse",
  "straight",
  "stairs",
  "bomb",
  "dog",
]);
export type CombinationType = typeof CombinationType.Type;

/**
 * A classified Combination. `rank` is the comparison rank: the single's value (Phoenix singles
 * carry half ranks, the Dragon is 15), the triple of a full house, or the top of a run.
 */
export const Combination = Schema.Struct({
  type: CombinationType,
  rank: Schema.Number,
  length: Schema.Int,
});
export type Combination = typeof Combination.Type;

/** The cards a Participant lays, with the rank the Phoenix stands for in a multi-card Combination. */
export const PlayCards = Schema.Struct({
  cards: Schema.Array(Card),
  phoenixAs: Schema.optionalKey(Rank),
});
export type PlayCards = typeof PlayCards.Type;

export interface KernelOptions {
  readonly quadBombNeedsDistinctSuits: boolean;
  readonly laterDragonWins: boolean;
}

export const standardKernelOptions: KernelOptions = {
  quadBombNeedsDistinctSuits: false,
  laterDragonWins: false,
};

const make = (type: CombinationType, rank: number, length: number): Combination => ({
  type,
  rank,
  length,
});

const isRun = (ranks: ReadonlyArray<number>): boolean =>
  ranks.every((rank, index) => index === 0 || rank === (ranks[index - 1] ?? 0) + 1);

/**
 * Classifies the cards of a Play against the Trick's current top Combination (undefined on a
 * lead). Returns undefined when the cards form no Combination. Does not check that the Play beats
 * the top; see `beats`.
 */
export const classify = (
  play: PlayCards,
  top: Combination | undefined,
  options: KernelOptions = standardKernelOptions,
): Combination | undefined => {
  const { cards, phoenixAs } = play;
  if (cards.length === 0) return undefined;

  if (cards.length === 1) {
    if (phoenixAs !== undefined) return undefined;
    const [card] = cards as [Card];
    switch (card._tag) {
      case "Normal":
        return make("single", card.rank, 1);
      case "MahJong":
        return make("single", MAH_JONG_RANK, 1);
      case "Dragon":
        return make("single", DRAGON_RANK, 1);
      case "Dog":
        return make("dog", 0, 1);
      case "Phoenix": {
        if (top === undefined || top.type !== "single") return make("single", 1.5, 1);
        // Never on the Dragon, and never on another Phoenix (the only single with a half rank).
        if (top.rank >= DRAGON_RANK || !Number.isInteger(top.rank)) return undefined;
        return make("single", top.rank + 0.5, 1);
      }
    }
  }

  const naturals: Array<NormalCard> = [];
  let phoenixes = 0;
  let mahJongs = 0;
  for (const card of cards) {
    if (card._tag === "Normal") naturals.push(card);
    else if (card._tag === "Phoenix") phoenixes++;
    else if (card._tag === "MahJong") mahJongs++;
    else return undefined;
  }
  if (phoenixes > 1 || mahJongs > 1) return undefined;
  if ((phoenixes === 1) !== (phoenixAs !== undefined)) return undefined;
  if (
    phoenixAs !== undefined &&
    !(Number.isInteger(phoenixAs) && phoenixAs >= 2 && phoenixAs <= 14)
  ) {
    return undefined;
  }

  const ranks = [
    ...naturals.map((card) => card.rank),
    ...(mahJongs === 1 ? [MAH_JONG_RANK] : []),
    ...(phoenixAs === undefined ? [] : [phoenixAs]),
  ].toSorted((a, b) => a - b);
  const counts = new Map<number, number>();
  for (const rank of ranks) counts.set(rank, (counts.get(rank) ?? 0) + 1);
  const distinct = [...counts.keys()].toSorted((a, b) => a - b);
  const highest = ranks[ranks.length - 1] ?? 0;
  const length = cards.length;

  // Bombs: natural cards only.
  if (phoenixes === 0 && mahJongs === 0) {
    if (length === 4 && distinct.length === 1) {
      const suitCount = new Set(naturals.map((card) => card.suit)).size;
      if (options.quadBombNeedsDistinctSuits && suitCount !== 4) return undefined;
      return make("bomb", highest, 4);
    }
    if (
      length >= 5 &&
      distinct.length === length &&
      isRun(distinct) &&
      new Set(naturals.map((card) => card.suit)).size === 1
    ) {
      return make("bomb", highest, length);
    }
  }

  if (mahJongs === 1 && !(length >= 5 && distinct.length === length && isRun(distinct))) {
    return undefined;
  }

  if (length === 2 && distinct.length === 1) return make("pair", highest, 2);
  if (length === 3 && distinct.length === 1) return make("triple", highest, 3);
  if (length === 5 && distinct.length === 2) {
    const [low = 0, high = 0] = distinct;
    if (counts.get(high) === 3) return make("fullHouse", high, 5);
    if (counts.get(low) === 3) return make("fullHouse", low, 5);
  }
  if (length >= 5 && distinct.length === length && isRun(distinct)) {
    return make("straight", highest, length);
  }
  if (
    length >= 4 &&
    length % 2 === 0 &&
    distinct.length === length / 2 &&
    isRun(distinct) &&
    distinct.every((rank) => counts.get(rank) === 2)
  ) {
    return make("stairs", highest, length);
  }
  return undefined;
};

const bombStrength = (bomb: Combination): number => bomb.length * 100 + bomb.rank;

/** Whether `candidate` may be laid on a Trick whose current top is `top`. */
export const beats = (
  candidate: Combination,
  top: Combination,
  options: KernelOptions = standardKernelOptions,
): boolean => {
  if (candidate.type === "dog" || top.type === "dog") return false;
  if (candidate.type === "bomb") {
    return top.type !== "bomb" || bombStrength(candidate) > bombStrength(top);
  }
  if (top.type === "bomb") return false;
  if (candidate.type !== top.type || candidate.length !== top.length) return false;
  if (
    candidate.type === "single" &&
    options.laterDragonWins &&
    candidate.rank === DRAGON_RANK &&
    top.rank === DRAGON_RANK
  ) {
    return true;
  }
  return candidate.rank > top.rank;
};
