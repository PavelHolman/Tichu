import type { Observation } from "@tichu/engine";
import type { TableView } from "@tichu/protocol";
import { describeCombination } from "./play.ts";

export const seatName = (table: TableView, seat: number, you: number | null): string => {
  if (seat === you) return "You";
  const occupant = table.seats[seat];
  if (occupant === null || occupant === undefined) return `Seat ${seat + 1}`;
  if (occupant._tag === "Player") return occupant.nickname;
  return `${occupant.tier === "random" ? "Easy Bot" : "Bot"} ${seat + 1}`;
};

export type TrickEntry = NonNullable<Observation["round"]>["trick"][number];

/** The latest entries of the Trick as one line, oldest first: "Kim: pair of 4s · Anna passed". */
export const trickHistory = (
  entries: ReadonlyArray<TrickEntry>,
  name: (seat: number) => string,
  latest = 4,
): string =>
  entries
    .slice(-latest)
    .map((entry) =>
      entry._tag === "Pass"
        ? `${name(entry.seat)} passed`
        : `${name(entry.seat)}: ${describeCombination(entry)}`,
    )
    .join(" · ");

export const cardCount = (count: number): string => `${count} ${count === 1 ? "card" : "cards"}`;
