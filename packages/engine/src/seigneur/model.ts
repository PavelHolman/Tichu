import { Schema } from "effect";
import { Card, Rank } from "../kernel/cards.ts";
import { PassCommand, PlayCommand, PlayDecision, Reactions } from "../kernel/choices.ts";
import { Passed, Played, SeatFinished, TrickWon } from "../kernel/events.ts";
import { Layout, Seat } from "../kernel/layout.ts";
import { TrickEntry, type KernelState } from "../kernel/trick.ts";

export const MIN_SEIGNEUR_SEATS = 5;
export const MAX_SEIGNEUR_SEATS = 12;

export const SeigneurSettings = Schema.Struct({
  seats: Schema.Int.check(
    Schema.isBetween({ minimum: MIN_SEIGNEUR_SEATS, maximum: MAX_SEIGNEUR_SEATS }),
  ),
  decks: Schema.Literals([1, 2]),
});
export type SeigneurSettings = typeof SeigneurSettings.Type;

/** Two Decks from seven Seats, one below. */
export const defaultSeigneurSettings = (seats: number): SeigneurSettings => ({
  seats,
  decks: seats >= 7 ? 2 : 1,
});

// Commands

/** Give the forced cards: the `count` best cards of the Hand, any among equal ranks. */
export const GiveBestCommand = Schema.TaggedStruct("GiveBest", {
  seat: Seat,
  cards: Schema.Array(Card),
});
/** Return any `count` cards to the Seat that gave. */
export const ReturnCardsCommand = Schema.TaggedStruct("ReturnCards", {
  seat: Seat,
  cards: Schema.Array(Card),
});

export const SeigneurCommand = Schema.Union([
  GiveBestCommand,
  ReturnCardsCommand,
  PlayCommand,
  PassCommand,
]);
export type SeigneurCommand = typeof SeigneurCommand.Type;

// Events

export const GrandSeigneurStarted = Schema.TaggedStruct("GrandSeigneurStarted", {
  layout: Layout,
  settings: SeigneurSettings,
});

/** The whole deal, and the Round's play order. */
export const CardsDealt = Schema.TaggedStruct("CardsDealt", {
  round: Schema.Int,
  order: Schema.Array(Seat),
  hands: Schema.Array(Schema.Array(Card)),
});

/** Private until `GiftsRevealed`, even to the recipient. */
export const BestCardsGiven = Schema.TaggedStruct("BestCardsGiven", {
  seat: Seat,
  to: Seat,
  cards: Schema.Array(Card),
});
export const GiftsRevealed = Schema.TaggedStruct("GiftsRevealed", {});

/** Private until `ReturnsRevealed`. */
export const CardsReturned = Schema.TaggedStruct("CardsReturned", {
  seat: Seat,
  to: Seat,
  cards: Schema.Array(Card),
});
export const ReturnsRevealed = Schema.TaggedStruct("ReturnsRevealed", {});

/** The Round ended; its finishing order is the new hierarchy, Great Lord first. */
export const HierarchySet = Schema.TaggedStruct("HierarchySet", {
  round: Schema.Int,
  finishingOrder: Schema.Array(Seat),
});

export const SeigneurEvent = Schema.Union([
  GrandSeigneurStarted,
  CardsDealt,
  BestCardsGiven,
  GiftsRevealed,
  CardsReturned,
  ReturnsRevealed,
  Played,
  Passed,
  SeatFinished,
  TrickWon,
  HierarchySet,
]);
export type SeigneurEvent = typeof SeigneurEvent.Type;

// State

export type SeigneurPhase = "giving" | "returning" | "playing" | "ended";

/** One forced Exchange pairing: `from` gives its `count` best cards to `to`, who returns as many. */
export interface ForcedPair {
  readonly from: Seat;
  readonly to: Seat;
  readonly count: number;
}

export interface SeigneurRound {
  readonly number: number;
  readonly phase: SeigneurPhase;
  readonly pairs: ReadonlyArray<ForcedPair>;
  /** Forced gifts submitted, by giving Seat. */
  readonly gifts: ReadonlyArray<ReadonlyArray<Card> | null>;
  /** Returns submitted, by returning Seat. */
  readonly returns: ReadonlyArray<ReadonlyArray<Card> | null>;
  readonly kernel: KernelState;
}

export interface SeigneurState {
  readonly variant: "grandSeigneur";
  readonly layout: Layout;
  readonly settings: SeigneurSettings;
  /** Seats from Great Lord to Wretch, set by the previous Round; null before the first ends. */
  readonly hierarchy: ReadonlyArray<Seat> | null;
  readonly round: SeigneurRound | null;
}

// Decisions and Observation

export const SeigneurDecision = Schema.Union([
  Schema.TaggedStruct("ForcedGive", {
    id: Schema.String,
    seat: Seat,
    to: Seat,
    count: Schema.Int,
    /** The engine's pick of the best cards; any cards of the same ranks are also accepted. */
    suggested: Schema.Array(Card),
  }),
  Schema.TaggedStruct("ReturnCards", {
    id: Schema.String,
    seat: Seat,
    to: Seat,
    count: Schema.Int,
  }),
  PlayDecision,
]);
export type SeigneurDecision = typeof SeigneurDecision.Type;

export const SeigneurObservation = Schema.Struct({
  variant: Schema.Literal("grandSeigneur"),
  seat: Seat,
  layout: Layout,
  settings: SeigneurSettings,
  hierarchy: Schema.NullOr(Schema.Array(Seat)),
  round: Schema.NullOr(
    Schema.Struct({
      number: Schema.Int,
      phase: Schema.Literals(["giving", "returning", "playing", "ended"]),
      order: Schema.Array(Seat),
      hand: Schema.Array(Card),
      handCounts: Schema.Array(Schema.Int),
      /** The forced pairings of this Round, and who has submitted the current step. */
      pairs: Schema.Array(Schema.Struct({ from: Seat, to: Seat, count: Schema.Int })),
      submitted: Schema.Array(Schema.Boolean),
      /** Cards this Seat gave and received in the forced Exchange, once revealed. */
      given: Schema.Array(Card),
      received: Schema.Array(Card),
      trick: Schema.Array(TrickEntry),
      turn: Schema.NullOr(Seat),
      wish: Schema.NullOr(Rank),
      finished: Schema.Array(Seat),
    }),
  ),
  decision: Schema.NullOr(SeigneurDecision),
  reactions: Reactions,
});
export type SeigneurObservation = typeof SeigneurObservation.Type;
