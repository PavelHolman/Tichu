/**
 * The engine across Variants: one entry point per operation that dispatches on the Variant a
 * Match was started with. The Table, the protocol and the Bots work only through this module.
 */
import { Effect, Schema } from "effect";
import { PassCommand, PlayCommand, type Reactions } from "./kernel/choices.ts";
import { violation, type RuleViolation } from "./kernel/errors.ts";
import type { Seat } from "./kernel/layout.ts";
import { seigneur } from "./seigneur/engine.ts";
import {
  GiveBestCommand,
  ReturnCardsCommand,
  SeigneurDecision,
  SeigneurEvent,
  SeigneurObservation,
  SeigneurSettings,
  type SeigneurCommand,
  type SeigneurState,
} from "./seigneur/model.ts";
import * as standard from "./standard/engine.ts";
import {
  CallTichuCommand,
  ExchangeCommand,
  GiftDragonCommand,
  GrandTichuCommand,
  StandardDecision,
  StandardEvent,
  StandardObservation,
  StandardSettings,
  type StandardCommand,
  type StandardState,
} from "./standard/model.ts";

export const GameSettings = Schema.Union([
  Schema.TaggedStruct("Standard", { match: StandardSettings }),
  Schema.TaggedStruct("GrandSeigneur", { match: SeigneurSettings }),
]);
export type GameSettings = typeof GameSettings.Type;

export const seatsFor = (settings: GameSettings): number =>
  settings._tag === "Standard" ? 4 : settings.match.seats;

export const GameCommand = Schema.Union([
  GrandTichuCommand,
  CallTichuCommand,
  ExchangeCommand,
  PlayCommand,
  PassCommand,
  GiftDragonCommand,
  GiveBestCommand,
  ReturnCardsCommand,
]);
export type GameCommand = typeof GameCommand.Type;

export const GameEvent = Schema.Union([...StandardEvent.members, ...SeigneurEvent.members]);
export type GameEvent = typeof GameEvent.Type;

export const Decision = Schema.Union([...StandardDecision.members, ...SeigneurDecision.members]);
export type Decision = typeof Decision.Type;

export const Observation = Schema.Union([StandardObservation, SeigneurObservation]);
export type Observation = typeof Observation.Type;

export type GameState = StandardState | SeigneurState;

const standardEventTags: ReadonlySet<string> = new Set([
  "MatchStarted",
  "RoundDealt",
  "GrandTichuDecided",
  "RemainingCardsDealt",
  "TichuCalled",
  "ExchangeSubmitted",
  "ExchangeCompleted",
  "Played",
  "Passed",
  "SeatFinished",
  "TrickWon",
  "DragonGiven",
  "RoundEnded",
  "MatchEnded",
] satisfies ReadonlyArray<StandardEvent["_tag"]>);

const seigneurEventTags: ReadonlySet<string> = new Set([
  "GrandSeigneurStarted",
  "CardsDealt",
  "BestCardsGiven",
  "GiftsRevealed",
  "CardsReturned",
  "ReturnsRevealed",
  "Played",
  "Passed",
  "SeatFinished",
  "TrickWon",
  "HierarchySet",
] satisfies ReadonlyArray<SeigneurEvent["_tag"]>);

const isStandardEvent = (event: GameEvent): event is StandardEvent =>
  standardEventTags.has(event._tag);
const isSeigneurEvent = (event: GameEvent): event is SeigneurEvent =>
  seigneurEventTags.has(event._tag);

const isStandardCommand = (command: GameCommand): command is StandardCommand =>
  command._tag !== "GiveBest" && command._tag !== "ReturnCards";
const isSeigneurCommand = (command: GameCommand): command is SeigneurCommand =>
  command._tag === "GiveBest" ||
  command._tag === "ReturnCards" ||
  command._tag === "Play" ||
  command._tag === "Pass";

export const start = (settings: GameSettings): Effect.Effect<ReadonlyArray<GameEvent>> =>
  settings._tag === "Standard" ? standard.start(settings.match) : seigneur.start(settings.match);

/** Folds one event; the first event of a Match decides the Variant. */
export const evolve = (state: GameState | null, event: GameEvent): GameState => {
  if (event._tag === "MatchStarted") return standard.evolve(standard.emptyStandardState, event);
  if (event._tag === "GrandSeigneurStarted") return seigneur.evolve(null, event);
  if (state === null) return standard.emptyStandardState;
  if (state.variant === "standard")
    return isStandardEvent(event) ? standard.evolve(state, event) : state;
  return isSeigneurEvent(event) ? seigneur.evolve(state, event) : state;
};

export const replay = (events: Iterable<GameEvent>, from: GameState | null = null): GameState => {
  let state = from;
  for (const event of events) state = evolve(state, event);
  return state ?? standard.emptyStandardState;
};

export const decide = (
  state: GameState,
  command: GameCommand,
): Effect.Effect<ReadonlyArray<GameEvent>, RuleViolation> => {
  if (state.variant === "standard") {
    return isStandardCommand(command)
      ? standard.decide(state, command)
      : Effect.fail(violation("WrongPhase", "That command belongs to another Variant"));
  }
  return isSeigneurCommand(command)
    ? seigneur.decide(state, command)
    : Effect.fail(violation("WrongPhase", "That command belongs to another Variant"));
};

export const pendingDecisions = (state: GameState): ReadonlyArray<Decision> =>
  state.variant === "standard"
    ? standard.pendingDecisions(state)
    : seigneur.pendingDecisions(state);

export const reactions = (state: GameState, seat: Seat): Reactions =>
  state.variant === "standard" ? standard.reactions(state, seat) : seigneur.reactions(state, seat);

export const observe = (state: GameState, seat: Seat): Observation =>
  state.variant === "standard" ? standard.observe(state, seat) : seigneur.observe(state, seat);

export const redact = (event: GameEvent, seat: Seat): GameEvent => {
  if (isStandardEvent(event)) return standard.redact(event, seat);
  return isSeigneurEvent(event) ? seigneur.redact(event, seat) : event;
};

/** Whether the Match has ended by its own rules. Grand Seigneur never does; the creator closes it. */
export const isOver = (state: GameState): boolean =>
  state.variant === "standard" && state.winningTeam !== null;

export const game = {
  start,
  evolve,
  replay,
  decide,
  pendingDecisions,
  reactions,
  observe,
  redact,
  isOver,
} as const;
