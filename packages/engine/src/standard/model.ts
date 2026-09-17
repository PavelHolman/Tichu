import { Schema } from "effect";
import { Card, Rank } from "../kernel/cards.ts";
import { PassCommand, PlayCommand, PlayDecision, Reactions } from "../kernel/choices.ts";
import { DragonGiven, Passed, Played, SeatFinished, TrickWon } from "../kernel/events.ts";
import { Layout, Seat } from "../kernel/layout.ts";
import { TrickEntry, type KernelState } from "../kernel/trick.ts";

export const StandardSettings = Schema.Struct({
  targetScore: Schema.Int.check(Schema.isGreaterThan(0)),
});
export type StandardSettings = typeof StandardSettings.Type;

export const defaultStandardSettings: StandardSettings = { targetScore: 1000 };

export const CallKind = Schema.Literals(["none", "tichu", "grandTichu"]);
export type CallKind = typeof CallKind.Type;

export const Give = Schema.Struct({ to: Seat, card: Card });
export type Give = typeof Give.Type;

// Commands

export const GrandTichuCommand = Schema.TaggedStruct("GrandTichu", {
  seat: Seat,
  call: Schema.Boolean,
});
export const CallTichuCommand = Schema.TaggedStruct("CallTichu", { seat: Seat });
export const ExchangeCommand = Schema.TaggedStruct("Exchange", {
  seat: Seat,
  gives: Schema.Array(Give),
});
export const GiftDragonCommand = Schema.TaggedStruct("GiftDragon", { seat: Seat, to: Seat });

export const StandardCommand = Schema.Union([
  GrandTichuCommand,
  CallTichuCommand,
  ExchangeCommand,
  PlayCommand,
  PassCommand,
  GiftDragonCommand,
]);
export type StandardCommand = typeof StandardCommand.Type;

// Events

export const MatchStarted = Schema.TaggedStruct("MatchStarted", {
  layout: Layout,
  settings: StandardSettings,
});

/** The whole deal. Seats see only their first eight cards until `RemainingCardsDealt`. */
export const RoundDealt = Schema.TaggedStruct("RoundDealt", {
  round: Schema.Int,
  hands: Schema.Array(Schema.Array(Card)),
});
export const FIRST_STAGE = 8;

/** Private until the Grand Tichu window closes: other Seats see only that a Seat decided. */
export const GrandTichuDecided = Schema.TaggedStruct("GrandTichuDecided", {
  seat: Seat,
  call: Schema.Boolean,
});
export const RemainingCardsDealt = Schema.TaggedStruct("RemainingCardsDealt", {
  grandTichus: Schema.Array(Seat),
});
export const TichuCalled = Schema.TaggedStruct("TichuCalled", { seat: Seat });
/** Private to the giving Seat until `ExchangeCompleted`. */
export const ExchangeSubmitted = Schema.TaggedStruct("ExchangeSubmitted", {
  seat: Seat,
  gives: Schema.Array(Give),
});
export const ExchangeCompleted = Schema.TaggedStruct("ExchangeCompleted", {});

export const CallResult = Schema.Struct({
  seat: Seat,
  call: CallKind,
  succeeded: Schema.Boolean,
  points: Schema.Int,
});
export type CallResult = typeof CallResult.Type;

export const RoundEnded = Schema.TaggedStruct("RoundEnded", {
  round: Schema.Int,
  finishingOrder: Schema.Array(Seat),
  oneTwo: Schema.Boolean,
  /** Card points (or the one-two 200) per Team, before Calls. */
  cardPoints: Schema.Array(Schema.Int),
  calls: Schema.Array(CallResult),
  /** Round score per Team, Calls included. */
  points: Schema.Array(Schema.Int),
  totals: Schema.Array(Schema.Int),
});
export type RoundEnded = typeof RoundEnded.Type;

export const MatchEnded = Schema.TaggedStruct("MatchEnded", {
  winningTeam: Schema.Int,
  totals: Schema.Array(Schema.Int),
});

export const StandardEvent = Schema.Union([
  MatchStarted,
  RoundDealt,
  GrandTichuDecided,
  RemainingCardsDealt,
  TichuCalled,
  ExchangeSubmitted,
  ExchangeCompleted,
  Played,
  Passed,
  SeatFinished,
  TrickWon,
  DragonGiven,
  RoundEnded,
  MatchEnded,
]);
export type StandardEvent = typeof StandardEvent.Type;

// State

export type RoundPhase = "grandTichu" | "exchange" | "playing" | "ended";

export interface StandardRound {
  readonly number: number;
  readonly phase: RoundPhase;
  readonly dealt: ReadonlyArray<ReadonlyArray<Card>>;
  readonly grandTichu: ReadonlyArray<boolean | null>;
  readonly calls: ReadonlyArray<CallKind>;
  readonly exchanges: ReadonlyArray<ReadonlyArray<Give> | null>;
  readonly kernel: KernelState;
}

export interface StandardState {
  readonly variant: "standard";
  readonly layout: Layout;
  readonly settings: StandardSettings;
  readonly totals: ReadonlyArray<number>;
  readonly round: StandardRound | null;
  readonly lastRound: RoundEnded | null;
  readonly winningTeam: number | null;
}

// Decisions, Reactions, Observation

export const StandardDecision = Schema.Union([
  Schema.TaggedStruct("GrandTichu", { id: Schema.String, seat: Seat }),
  /** Give one card from the Hand to each Seat in `to`. */
  Schema.TaggedStruct("Exchange", { id: Schema.String, seat: Seat, to: Schema.Array(Seat) }),
  PlayDecision,
  Schema.TaggedStruct("DragonGift", { id: Schema.String, seat: Seat, to: Schema.Array(Seat) }),
]);
export type StandardDecision = typeof StandardDecision.Type;

export const StandardObservation = Schema.Struct({
  variant: Schema.Literal("standard"),
  seat: Seat,
  layout: Layout,
  settings: StandardSettings,
  totals: Schema.Array(Schema.Int),
  winningTeam: Schema.NullOr(Schema.Int),
  lastRound: Schema.NullOr(RoundEnded),
  round: Schema.NullOr(
    Schema.Struct({
      number: Schema.Int,
      phase: Schema.Literals(["grandTichu", "exchange", "playing", "ended"]),
      hand: Schema.Array(Card),
      handCounts: Schema.Array(Schema.Int),
      calls: Schema.Array(CallKind),
      /** Seats that have made their Grand Tichu Decision, or submitted their Exchange. */
      decided: Schema.Array(Schema.Boolean),
      /** The cards this Seat gave, once submitted, and received, once the Exchange completed. */
      given: Schema.Array(Give),
      received: Schema.Array(Schema.Struct({ from: Seat, card: Card })),
      trick: Schema.Array(TrickEntry),
      turn: Schema.NullOr(Seat),
      wish: Schema.NullOr(Rank),
      finished: Schema.Array(Seat),
      /** Cards collected from Tricks per Seat. */
      wonCounts: Schema.Array(Schema.Int),
      pendingGift: Schema.NullOr(Seat),
    }),
  ),
  decision: Schema.NullOr(StandardDecision),
  reactions: Reactions,
});
export type StandardObservation = typeof StandardObservation.Type;
