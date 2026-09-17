import { Schema } from "effect";

export const Suit = Schema.Literals(["jade", "sword", "pagoda", "star"]);
export type Suit = typeof Suit.Type;
export const suits: ReadonlyArray<Suit> = ["jade", "sword", "pagoda", "star"];

/** 2..14, where 11 = J, 12 = Q, 13 = K, 14 = A. */
export const Rank = Schema.Int.check(Schema.isBetween({ minimum: 2, maximum: 14 }));
export type Rank = number;

const Copy = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0));

export const Card = Schema.TaggedUnion({
  Normal: { suit: Suit, rank: Rank, copy: Copy },
  MahJong: { copy: Copy },
  Dog: { copy: Copy },
  Phoenix: { copy: Copy },
  Dragon: { copy: Copy },
});
export type Card = typeof Card.Type;
export type NormalCard = Extract<Card, { _tag: "Normal" }>;

export const MAH_JONG_RANK = 1;
export const DRAGON_RANK = 15;

export const normal = (suit: Suit, rank: Rank, copy = 0): Card => ({
  _tag: "Normal",
  suit,
  rank,
  copy,
});
export const mahJong = (copy = 0): Card => ({ _tag: "MahJong", copy });
export const dog = (copy = 0): Card => ({ _tag: "Dog", copy });
export const phoenix = (copy = 0): Card => ({ _tag: "Phoenix", copy });
export const dragon = (copy = 0): Card => ({ _tag: "Dragon", copy });

/** A stable identity for a card instance; two Decks are told apart by the copy index. */
export const cardKey = (card: Card): string =>
  card._tag === "Normal" ? `${card.suit}-${card.rank}#${card.copy}` : `${card._tag}#${card.copy}`;

export const sameCard = (a: Card, b: Card): boolean => cardKey(a) === cardKey(b);

export const isNormal = (card: Card): card is NormalCard => card._tag === "Normal";

/** Card points at scoring: K and 10 are 10, 5 is 5, Dragon +25, Phoenix -25. */
export const cardPoints = (card: Card): number => {
  switch (card._tag) {
    case "Normal":
      return card.rank === 13 || card.rank === 10 ? 10 : card.rank === 5 ? 5 : 0;
    case "Dragon":
      return 25;
    case "Phoenix":
      return -25;
    default:
      return 0;
  }
};

export const sumPoints = (cards: ReadonlyArray<Card>): number =>
  cards.reduce((total, card) => total + cardPoints(card), 0);

/** Sort order for display and canonical listing: Dog, Mah Jong, 2..A, Phoenix, Dragon. */
export const sortValue = (card: Card): number => {
  switch (card._tag) {
    case "Dog":
      return 0;
    case "MahJong":
      return 1;
    case "Normal":
      return card.rank * 4 + suits.indexOf(card.suit);
    case "Phoenix":
      return 70;
    case "Dragon":
      return 80;
  }
};

export const sortCards = (cards: ReadonlyArray<Card>): Array<Card> =>
  cards.toSorted((a, b) => sortValue(a) - sortValue(b) || a.copy - b.copy);

export interface DeckSpec {
  /** How many copies of the Deck are shuffled together. */
  readonly copies: number;
  readonly withDog: boolean;
  /** How many Mah Jongs stay in when several copies are used. */
  readonly mahJongs: number;
}

export const standardDeck: DeckSpec = { copies: 1, withDog: true, mahJongs: 1 };

export const buildDeck = (spec: DeckSpec): Array<Card> => {
  const cards: Array<Card> = [];
  for (let copy = 0; copy < spec.copies; copy++) {
    for (const suit of suits) {
      for (let rank = 2; rank <= 14; rank++) cards.push(normal(suit, rank, copy));
    }
    if (copy < spec.mahJongs) cards.push(mahJong(copy));
    if (spec.withDog) cards.push(dog(copy));
    cards.push(phoenix(copy), dragon(copy));
  }
  return cards;
};

/** Removes `taken` from `hand` by card identity; undefined if any card is missing. */
export const removeCards = (
  hand: ReadonlyArray<Card>,
  taken: ReadonlyArray<Card>,
): Array<Card> | undefined => {
  const remaining = [...hand];
  for (const card of taken) {
    const index = remaining.findIndex((held) => sameCard(held, card));
    if (index === -1) return undefined;
    remaining.splice(index, 1);
  }
  return remaining;
};
