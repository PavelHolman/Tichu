import { Schema } from "effect";
import { Card, Rank } from "./cards.ts";
import { Combination } from "./combination.ts";
import { Seat } from "./layout.ts";

export const PlayOption = Schema.Struct({
  cards: Schema.Array(Card),
  phoenixAs: Schema.optionalKey(Rank),
  combination: Combination,
});
export type PlayOption = typeof PlayOption.Type;

export const WISH_RANKS: ReadonlyArray<Rank> = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

/** Lay one of `plays` (with an optional Wish when it holds the Mah Jong), or Pass if allowed. */
export const PlayDecision = Schema.TaggedStruct("Play", {
  id: Schema.String,
  seat: Seat,
  plays: Schema.Array(PlayOption),
  canPass: Schema.Boolean,
});
export type PlayDecision = typeof PlayDecision.Type;

export const Reactions = Schema.Struct({
  callTichu: Schema.Boolean,
  bombs: Schema.Array(PlayOption),
});
export type Reactions = typeof Reactions.Type;

export const PlayCommand = Schema.TaggedStruct("Play", {
  seat: Seat,
  cards: Schema.Array(Card),
  phoenixAs: Schema.optionalKey(Rank),
  wish: Schema.optionalKey(Rank),
});
export const PassCommand = Schema.TaggedStruct("Pass", { seat: Seat });
