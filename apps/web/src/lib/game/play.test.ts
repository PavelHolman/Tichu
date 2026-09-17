import { describe, expect, it } from "@effect/vitest";
import { classify, normal, phoenix, type Card, type PlayOption } from "@tichu/engine";
import {
  describeCombination,
  matchingOptions,
  rankLabel,
  ringPositions,
  seatsByPosition,
} from "./play.ts";

const option = (cards: Array<Card>, phoenixAs?: number): PlayOption => {
  const play = phoenixAs === undefined ? { cards } : { cards, phoenixAs };
  return { ...play, combination: classify(play, undefined)! };
};

describe("ringPositions", () => {
  it("puts me at the bottom, the next Seat in play order to the right and the partner on top", () => {
    expect(ringPositions(4, 1)).toEqual({ bottom: 1, right: 2, top: 3, left: 0 });
    expect(seatsByPosition(4, 0)).toEqual([
      ["bottom", 0],
      ["right", 1],
      ["top", 2],
      ["left", 3],
    ]);
  });
});

describe("matchingOptions", () => {
  const sevens = [normal("jade", 7), normal("sword", 7)];
  const straight = [
    normal("jade", 5),
    normal("sword", 6),
    normal("jade", 7),
    normal("star", 8),
    phoenix(),
  ];

  it("finds the options laying exactly the selected cards, in any order", () => {
    const options = [option(sevens), option([normal("jade", 7)])];
    expect(matchingOptions(sevens.toReversed(), options)).toEqual([options[0]]);
    expect(matchingOptions([normal("jade", 7), normal("pagoda", 7)], options)).toEqual([]);
  });

  it("lists every Phoenix reading, highest first", () => {
    const options = [option(straight, 4), option(straight, 9)];
    expect(matchingOptions(straight, options).map((found) => found.phoenixAs)).toEqual([9, 4]);
  });
});

describe("describeCombination", () => {
  it.each([
    [[normal("jade", 9), normal("sword", 9)], "pair of 9s"],
    [[normal("jade", 14)], "A"],
    [
      [
        normal("jade", 12),
        normal("sword", 12),
        normal("star", 12),
        normal("jade", 3),
        normal("star", 3),
      ],
      "full house, Qs",
    ],
    [
      [
        normal("jade", 2),
        normal("jade", 3),
        normal("jade", 4),
        normal("jade", 5),
        normal("jade", 6),
      ],
      "Bomb, straight flush to 6",
    ],
    [[normal("jade", 5), normal("sword", 5), normal("jade", 6), normal("sword", 6)], "stairs to 6"],
  ] as const)("%#", (cards, text) => {
    expect(describeCombination(option([...cards]))).toBe(text);
  });

  it("names the special singles", () => {
    expect(describeCombination(option([phoenix()]))).toBe("Phoenix");
    expect(rankLabel(10)).toBe("10");
    expect(rankLabel(11)).toBe("J");
  });
});
