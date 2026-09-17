import { describe, expect, it } from "@effect/vitest";
import { beats, classify, standardKernelOptions, type Combination } from "../src/index.ts";
import { cards } from "./helpers.ts";

const lead = (spec: string, phoenixAs?: number) =>
  classify({ cards: cards(spec), ...(phoenixAs === undefined ? {} : { phoenixAs }) }, undefined);

describe("classify", () => {
  it.each([
    ["7j", { type: "single", rank: 7, length: 1 }],
    ["Mj", { type: "single", rank: 1, length: 1 }],
    ["Dr", { type: "single", rank: 15, length: 1 }],
    ["Ph", { type: "single", rank: 1.5, length: 1 }],
    ["Dg", { type: "dog", rank: 0, length: 1 }],
    ["7j 7s", { type: "pair", rank: 7, length: 2 }],
    ["7j 7s 7p", { type: "triple", rank: 7, length: 3 }],
    ["7j 7s 7p 3j 3s", { type: "fullHouse", rank: 7, length: 5 }],
    ["3j 4s 5p 6j 7s", { type: "straight", rank: 7, length: 5 }],
    ["Mj 2s 3p 4j 5s", { type: "straight", rank: 5, length: 5 }],
    ["3j 3s 4p 4j", { type: "stairs", rank: 4, length: 4 }],
    ["3j 3s 4p 4j 5j 5s", { type: "stairs", rank: 5, length: 6 }],
    ["9j 9s 9p 9t", { type: "bomb", rank: 9, length: 4 }],
    ["3j 4j 5j 6j 7j", { type: "bomb", rank: 7, length: 5 }],
  ] as const)("%s", (spec, expected) => {
    expect(lead(spec)).toEqual(expected);
  });

  it("uses the named Phoenix rank inside a Combination", () => {
    expect(lead("7j Ph", 7)).toEqual({ type: "pair", rank: 7, length: 2 });
    expect(lead("Aj As Ph 9j 9s", 14)).toEqual({ type: "fullHouse", rank: 14, length: 5 });
    expect(lead("Aj As Ph 9j 9s", 9)).toEqual({ type: "fullHouse", rank: 9, length: 5 });
    expect(lead("5j 6s 7j 8s Ph", 4)).toEqual({ type: "straight", rank: 8, length: 5 });
    expect(lead("5j 6s 7j 8s Ph", 9)).toEqual({ type: "straight", rank: 9, length: 5 });
  });

  it("classifies a Phoenix single half a rank above the single it lands on", () => {
    const top: Combination = { type: "single", rank: 14, length: 1 };
    expect(classify({ cards: cards("Ph") }, top)).toEqual({
      type: "single",
      rank: 14.5,
      length: 1,
    });
  });

  it.each([
    ["7j 8s", undefined],
    ["7j Ph", undefined],
    ["7j 7s", 7],
    ["7j Ph", 8],
    ["Ph", 7],
    ["3j 3s 3p 3t Ph", 3],
    ["Dr Dr'1", undefined],
    ["Dg 2j", undefined],
    ["Mj Mj'1", undefined],
    ["Jj Qs Kp Aj 2s", undefined],
    ["Ph 2s 3p 4j 5s", 1],
    ["3j 3s 5p 5j", undefined],
  ] as const)("rejects %s with Phoenix as %s", (spec, phoenixAs) => {
    expect(lead(spec, phoenixAs)).toBeUndefined();
  });

  it("never makes a Bomb from the Mah Jong or the Phoenix", () => {
    expect(lead("Mj 2j 3j 4j 5j")?.type).toBe("straight");
    expect(lead("3j 4j 5j 6j Ph", 7)?.type).toBe("straight");
  });

  it("accepts four of a kind across two Decks without the distinct-suits option", () => {
    expect(lead("7j 7j'1 7s 7p")?.type).toBe("bomb");
  });

  it("rejects a Phoenix single on another Phoenix", () => {
    expect(
      classify({ cards: cards("Ph'1") }, { type: "single", rank: 8.5, length: 1 }),
    ).toBeUndefined();
  });

  it("rejects a Phoenix single on the Dragon", () => {
    expect(
      classify({ cards: cards("Ph") }, { type: "single", rank: 15, length: 1 }),
    ).toBeUndefined();
  });

  it("needs four distinct suits for a four-of-a-kind Bomb when the option is on", () => {
    const options = { ...standardKernelOptions, quadBombNeedsDistinctSuits: true };
    expect(classify({ cards: cards("7j 7j'1 7s 7p") }, undefined, options)).toBeUndefined();
    expect(classify({ cards: cards("7j 7t 7s 7p") }, undefined, options)?.type).toBe("bomb");
  });
});

describe("beats", () => {
  const combo = (spec: string, phoenixAs?: number) => {
    const result = lead(spec, phoenixAs);
    if (result === undefined) return expect.unreachable(`not a Combination: ${spec}`);
    return result;
  };

  it("compares same type and length by rank", () => {
    expect(beats(combo("8j"), combo("7j"))).toBe(true);
    expect(beats(combo("7s"), combo("7j"))).toBe(false);
    expect(beats(combo("8j 8s"), combo("7j 7s"))).toBe(true);
    expect(beats(combo("8j 8s"), combo("7j 7s 7p"))).toBe(false);
    expect(beats(combo("4j 5s 6p 7j 8s"), combo("3j 4s 5p 6j 7s"))).toBe(true);
    expect(beats(combo("4j 5s 6p 7j 8s 9s"), combo("3j 4s 5p 6j 7s"))).toBe(false);
    expect(beats(combo("2j 2s 2p Kj Ks"), combo("Aj As Ph 9j 9s", 9))).toBe(false);
    expect(beats(combo("10j 10s 10p 2j 2s"), combo("Aj As Ph 9j 9s", 9))).toBe(true);
  });

  it("lets the Dragon beat any single and a Phoenix beat an Ace but not the Dragon", () => {
    expect(beats(combo("Dr"), combo("Aj"))).toBe(true);
    expect(beats({ type: "single", rank: 14.5, length: 1 }, combo("Aj"))).toBe(true);
    expect(beats(combo("2j"), combo("Ph"))).toBe(true);
    expect(beats(combo("Mj"), combo("Ph"))).toBe(false);
  });

  it("orders Bombs by length then rank and lets them beat anything else", () => {
    expect(beats(combo("2j 2s 2p 2t"), combo("Dr"))).toBe(true);
    expect(beats(combo("2j 3j 4j 5j 6j"), combo("Aj As Ap At"))).toBe(true);
    expect(beats(combo("2j 3j 4j 5j 6j 7j"), combo("9s 10s Js Qs Ks"))).toBe(true);
    expect(beats(combo("Aj As Ap At"), combo("2j 3j 4j 5j 6j"))).toBe(false);
    expect(beats(combo("7j 7s 7p 7t"), combo("7j'1 7s'1 7p'1 7t'1"))).toBe(false);
    expect(beats(combo("Dr"), combo("2j 2s 2p 2t"))).toBe(false);
  });

  it("lets a later identical Dragon win only with the option", () => {
    expect(beats(combo("Dr'1"), combo("Dr"))).toBe(false);
    expect(
      beats(combo("Dr'1"), combo("Dr"), { ...standardKernelOptions, laterDragonWins: true }),
    ).toBe(true);
  });
});
