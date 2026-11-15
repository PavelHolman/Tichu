import { MAH_JONG_RANK, type Card, type NormalCard } from "./cards.ts";
import {
  classify,
  standardKernelOptions,
  type Combination,
  type KernelOptions,
  type PlayCards,
} from "./combination.ts";

/** A Play's cards together with the Combination they form. */
export interface CombinationOption extends PlayCards {
  readonly combination: Combination;
}

/** A way to show `count` cards of one rank: natural cards, possibly with the Phoenix filling one. */
interface Part {
  readonly cards: ReadonlyArray<Card>;
  readonly usesPhoenix: boolean;
}

const choose = <A>(items: ReadonlyArray<A>, k: number): Array<Array<A>> => {
  if (k === 0) return [[]];
  const result: Array<Array<A>> = [];
  items.forEach((item, index) => {
    for (const rest of choose(items.slice(index + 1), k - 1)) result.push([item, ...rest]);
  });
  return result;
};

/**
 * Every Combination that can be laid from `hand` as a lead. Phoenix singles are listed with their
 * lead value; `legalPlays` re-classifies them against the Trick.
 */
export const combinationsInHand = (
  hand: ReadonlyArray<Card>,
  options: KernelOptions = standardKernelOptions,
): Array<CombinationOption> => {
  const byRank = new Map<number, Array<NormalCard>>();
  let phoenix: Card | undefined;
  let mahJong: Card | undefined;
  const result: Array<CombinationOption> = [];
  const emit = (cards: ReadonlyArray<Card>, phoenixAs: number | undefined) => {
    const play: PlayCards = phoenixAs === undefined ? { cards } : { cards, phoenixAs };
    const combination = classify(play, undefined, options);
    if (combination !== undefined) result.push({ ...play, combination });
  };

  for (const card of hand) {
    if (card._tag === "Normal") byRank.set(card.rank, [...(byRank.get(card.rank) ?? []), card]);
    else if (card._tag === "Phoenix") phoenix ??= card;
    else if (card._tag === "MahJong") mahJong ??= card;
    emit([card], undefined);
  }

  const naturals = (rank: number): ReadonlyArray<NormalCard> => byRank.get(rank) ?? [];

  /** Ways to show `count` cards of `rank`; with the Phoenix at least one natural card remains. */
  const parts = (rank: number, count: number): Array<Part> => {
    const natural = choose(naturals(rank), count).map((cards) => ({ cards, usesPhoenix: false }));
    if (phoenix === undefined || count < 2) return natural;
    const withPhoenix = choose(naturals(rank), count - 1).map((cards) => ({
      cards: [...cards, phoenix as Card],
      usesPhoenix: true,
    }));
    return [...natural, ...withPhoenix];
  };

  for (let rank = 2; rank <= 14; rank++) {
    for (const part of [...parts(rank, 2), ...parts(rank, 3)]) {
      emit(part.cards, part.usesPhoenix ? rank : undefined);
    }
    for (const cards of choose(naturals(rank), 4)) emit(cards, undefined);
  }

  // Full houses: a triple and a pair of different ranks, the Phoenix in at most one of them.
  for (let tripleRank = 2; tripleRank <= 14; tripleRank++) {
    const triples = parts(tripleRank, 3);
    if (triples.length === 0) continue;
    for (let pairRank = 2; pairRank <= 14; pairRank++) {
      if (pairRank === tripleRank) continue;
      for (const pair of parts(pairRank, 2)) {
        for (const triple of triples) {
          if (triple.usesPhoenix && pair.usesPhoenix) continue;
          const phoenixAs = triple.usesPhoenix
            ? tripleRank
            : pair.usesPhoenix
              ? pairRank
              : undefined;
          emit([...triple.cards, ...pair.cards], phoenixAs);
        }
      }
    }
  }

  // Straights (and straight-flush Bombs): one card per consecutive rank, at least five long.
  interface Run {
    readonly cards: ReadonlyArray<Card>;
    readonly phoenixAs: number | undefined;
  }
  for (let start = MAH_JONG_RANK; start <= 10; start++) {
    let runs: Array<Run> =
      start === MAH_JONG_RANK
        ? mahJong === undefined
          ? []
          : [{ cards: [mahJong], phoenixAs: undefined }]
        : [
            ...naturals(start).map((card) => ({ cards: [card], phoenixAs: undefined })),
            ...(phoenix === undefined ? [] : [{ cards: [phoenix], phoenixAs: start }]),
          ];
    for (let rank = start + 1; rank <= 14 && runs.length > 0; rank++) {
      const extended: Array<Run> = [];
      for (const run of runs) {
        for (const card of naturals(rank)) {
          extended.push({ cards: [...run.cards, card], phoenixAs: run.phoenixAs });
        }
        if (phoenix !== undefined && run.phoenixAs === undefined) {
          extended.push({ cards: [...run.cards, phoenix], phoenixAs: rank });
        }
      }
      runs = extended;
      if (rank - start + 1 >= 5) for (const run of runs) emit(run.cards, run.phoenixAs);
    }
  }

  // Stairs: consecutive pairs, at least two.
  for (let start = 2; start <= 13; start++) {
    let runs: Array<Run> = parts(start, 2).map((part) => ({
      cards: part.cards,
      phoenixAs: part.usesPhoenix ? start : undefined,
    }));
    for (let rank = start + 1; rank <= 14 && runs.length > 0; rank++) {
      const extended: Array<Run> = [];
      for (const run of runs) {
        for (const part of parts(rank, 2)) {
          if (part.usesPhoenix && run.phoenixAs !== undefined) continue;
          extended.push({
            cards: [...run.cards, ...part.cards],
            phoenixAs: part.usesPhoenix ? rank : run.phoenixAs,
          });
        }
      }
      runs = extended;
      for (const run of runs) emit(run.cards, run.phoenixAs);
    }
  }

  return result;
};
