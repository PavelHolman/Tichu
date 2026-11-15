import { describe, expect, it } from "@effect/vitest";
import { normal } from "@tichu/engine";
import { defaultTableSettings, type TableView } from "@tichu/protocol";
import { seatName, trickHistory } from "./names.ts";

const table: TableView = {
  id: "abcdefghij",
  settings: defaultTableSettings,
  status: "playing",
  creator: 0,
  seats: [
    { _tag: "Player", nickname: "Anna", connected: true, takeoverAt: null },
    { _tag: "Bot", tier: "heuristic" },
    { _tag: "Bot", tier: "random" },
    null,
  ],
};

describe("names", () => {
  it("names Players, numbered Bots and yourself", () => {
    expect([0, 1, 2, 3].map((seat) => seatName(table, seat, 3))).toEqual([
      "Anna",
      "Bot 2",
      "Easy Bot 3",
      "You",
    ]);
  });

  it("summarises the latest Trick entries", () => {
    const pair = { type: "pair", rank: 4, length: 2 } as const;
    const entries = [
      { _tag: "Play", seat: 1, cards: [normal("jade", 4), normal("star", 4)], combination: pair },
      { _tag: "Pass", seat: 2 },
      { _tag: "Pass", seat: 3 },
    ] as const;
    const name = (seat: number) => seatName(table, seat, 3);
    expect(trickHistory(entries, name)).toBe("Bot 2: pair of 4s · Easy Bot 3 passed · You passed");
    expect(trickHistory(entries, name, 1)).toBe("You passed");
  });
});
