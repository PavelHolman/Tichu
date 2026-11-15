import { describe, expect, it } from "@effect/vitest";
import { ovalPositions, rankTitles } from "./hierarchy.ts";

describe("rankTitles", () => {
  it.each([5, 6, 7, 12])("names every rank for %i Seats, Great Lord to Wretch", (seats) => {
    const titles = rankTitles(seats);
    expect(titles).toHaveLength(seats);
    expect(new Set(titles).size).toBe(seats);
    expect(titles[0]).toBe("Great Lord");
    expect(titles.at(-1)).toBe("Wretch");
  });

  it("uses the printed six titles for six Seats", () => {
    expect(rankTitles(6)).toEqual(["Great Lord", "Lord", "Squire", "Burgher", "Pauper", "Wretch"]);
  });
});

describe("ovalPositions", () => {
  it("gives the four-Seat ring for three others: right, top, left", () => {
    const [right, top, left] = ovalPositions(3);
    expect(right!.left).toBeGreaterThan(50);
    expect(top).toEqual({ left: 50, top: 3 });
    expect(left!.left).toBeLessThan(50);
  });

  it.each([4, 5, 7, 11])(
    "places %i others without two on the same spot, rising on the right",
    (others) => {
      const positions = ovalPositions(others);
      expect(positions).toHaveLength(others);
      expect(new Set(positions.map((p) => `${p.left}:${p.top}`)).size).toBe(others);
      expect(positions[0]!.left).toBeGreaterThan(50);
      expect(positions.at(-1)!.left).toBeLessThan(50);
    },
  );
});
