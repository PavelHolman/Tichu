const TOP = ["Great Lord", "Lord", "Squire"];
const BOTTOM = ["Burgher", "Pauper", "Wretch"];
const MIDDLE = ["Knight", "Merchant", "Yeoman", "Tenant", "Peasant", "Serf"];

/** Hierarchy titles for `seats` Participants, Great Lord first and Wretch last. */
export const rankTitles = (seats: number): Array<string> =>
  seats === 5
    ? [...TOP, ...BOTTOM.slice(1)]
    : [...TOP, ...MIDDLE.slice(0, Math.max(0, seats - 6)), ...BOTTOM];

/**
 * Positions, in percent of the play area, for the other Seats in play order: up the right side,
 * across the top from right to left, and down the left side. Three others give the four-Seat ring.
 */
export const ovalPositions = (others: number): Array<{ left: number; top: number }> => {
  const side = Math.max(1, Math.floor(others / 3));
  const across = Math.max(0, others - 2 * side);
  const column = (index: number) => (side === 1 ? 30 : 40 - (index * 26) / (side - 1));
  const right = Array.from({ length: side }, (_, index) => ({ left: 84, top: column(index) }));
  const top = Array.from({ length: across }, (_, index) => ({
    left: across === 1 ? 50 : 76 - (index * 52) / (across - 1),
    top: 3,
  }));
  const left = Array.from({ length: side }, (_, index) => ({
    left: 16,
    top: column(side - 1 - index),
  }));
  return [...right, ...top, ...left].slice(0, others);
};
