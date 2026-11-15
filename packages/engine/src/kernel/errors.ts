import { Schema } from "effect";

export const RuleViolationReason = Schema.Literals([
  "MatchOver",
  "WrongPhase",
  "NotYourTurn",
  "AlreadyDecided",
  "CardsNotInHand",
  "NotACombination",
  "DoesNotBeat",
  "WishNotHonoured",
  "InvalidWish",
  "PassNotAllowed",
  "CallNotAllowed",
  "InvalidExchange",
  "InvalidRecipient",
]);
export type RuleViolationReason = typeof RuleViolationReason.Type;

/** A command the rules do not allow in the current state. */
export class RuleViolation extends Schema.TaggedError<RuleViolation>()("RuleViolation", {
  reason: RuleViolationReason,
  message: Schema.String,
}) {}

export const violation = (reason: RuleViolationReason, message: string) =>
  new RuleViolation({ reason, message });
