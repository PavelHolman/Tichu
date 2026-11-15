import { dog, dragon, mahJong, normal, phoenix, type Card, type Suit } from "../src/index.ts";

const suitByLetter: Record<string, Suit> = { j: "jade", s: "sword", p: "pagoda", t: "star" };
const rankByName: Record<string, number> = { J: 11, Q: 12, K: 13, A: 14 };

/**
 * Parses a compact card list: "7j 7s As Ph Dr Mj Dg", with an optional copy suffix "7j'1".
 * Suit letters: j jade, s sword, p pagoda, t star.
 */
export const cards = (spec: string): Array<Card> =>
  spec
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .map((token) => {
      const [body = "", copyText] = token.split("'");
      const copy = copyText === undefined ? 0 : Number(copyText);
      if (body === "Ph") return phoenix(copy);
      if (body === "Dr") return dragon(copy);
      if (body === "Mj") return mahJong(copy);
      if (body === "Dg") return dog(copy);
      const rankText = body.slice(0, -1);
      const suit = suitByLetter[body.slice(-1)];
      const rank = rankByName[rankText] ?? Number(rankText);
      if (suit === undefined || !(rank >= 2 && rank <= 14)) return phoenix(-1);
      return normal(suit, rank, copy);
    });
