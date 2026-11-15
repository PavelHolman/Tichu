import { cardKey, type Card, type Combination, type PlayOption, type Seat } from "@tichu/engine";

export type Position = "bottom" | "right" | "top" | "left";

/**
 * Where each Seat sits around a four-Seat ring from `me`'s point of view. Play goes to the right
 * (counter-clockwise), so the next Seat in play order is on the right and the partner on top.
 */
export const ringPositions = (seats: number, me: Seat): Record<Position, Seat> => ({
  bottom: me,
  right: (me + 1) % seats,
  top: (me + 2) % seats,
  left: (me + 3) % seats,
});

export const seatsByPosition = (seats: number, me: Seat): Array<[Position, Seat]> => {
  const ring = ringPositions(seats, me);
  return (["bottom", "right", "top", "left"] as const).map((position) => [
    position,
    ring[position],
  ]);
};

const selectionKey = (cards: ReadonlyArray<Card>) => cards.map(cardKey).toSorted().join(",");

/** The options that lay exactly the selected cards, the highest Phoenix reading first. */
export const matchingOptions = (
  selection: ReadonlyArray<Card>,
  options: ReadonlyArray<PlayOption>,
): Array<PlayOption> => {
  if (selection.length === 0) return [];
  const wanted = selectionKey(selection);
  return options
    .filter(
      (option) => option.cards.length === selection.length && selectionKey(option.cards) === wanted,
    )
    .toSorted((a, b) => b.combination.rank - a.combination.rank);
};

const RANK_LABELS: Record<number, string> = { 11: "J", 12: "Q", 13: "K", 14: "A" };

export const rankLabel = (rank: number): string => RANK_LABELS[rank] ?? String(rank);

const plural = (rank: number) => `${rankLabel(rank)}s`;

const singleLabel = (cards: ReadonlyArray<Card>, combination: Combination): string => {
  const [card] = cards;
  switch (card?._tag) {
    case "Phoenix":
      return "Phoenix";
    case "Dragon":
      return "Dragon";
    case "MahJong":
      return "Mah Jong";
    case "Dog":
      return "Dog";
    default:
      return rankLabel(combination.rank);
  }
};

/** A short English name for a laid Combination, e.g. "pair of 9s" or "straight to K". */
export const describeCombination = (play: {
  readonly cards: ReadonlyArray<Card>;
  readonly combination: Combination;
}): string => {
  const { combination } = play;
  switch (combination.type) {
    case "single":
    case "dog":
      return singleLabel(play.cards, combination);
    case "pair":
      return `pair of ${plural(combination.rank)}`;
    case "triple":
      return `three ${plural(combination.rank)}`;
    case "fullHouse":
      return `full house, ${plural(combination.rank)}`;
    case "straight":
      return `straight to ${rankLabel(combination.rank)}`;
    case "stairs":
      return `stairs to ${rankLabel(combination.rank)}`;
    case "bomb":
      return combination.length === 4
        ? `Bomb, four ${plural(combination.rank)}`
        : `Bomb, straight flush to ${rankLabel(combination.rank)}`;
  }
};
