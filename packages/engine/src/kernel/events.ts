import { Schema } from "effect";
import { Card, Rank } from "./cards.ts";
import { Combination } from "./combination.ts";
import { Seat } from "./layout.ts";

export const Played = Schema.TaggedStruct("Played", {
  seat: Seat,
  cards: Schema.Array(Card),
  phoenixAs: Schema.optionalKey(Rank),
  wish: Schema.optionalKey(Rank),
  combination: Combination,
});
export type Played = typeof Played.Type;

export const Passed = Schema.TaggedStruct("Passed", { seat: Seat });
export type Passed = typeof Passed.Type;

/** A Seat played its last card; `place` counts from 1. */
export const SeatFinished = Schema.TaggedStruct("SeatFinished", { seat: Seat, place: Schema.Int });
export type SeatFinished = typeof SeatFinished.Type;

/** The Trick closed and `seat` won it. */
export const TrickWon = Schema.TaggedStruct("TrickWon", { seat: Seat });
export type TrickWon = typeof TrickWon.Type;

export const DragonGiven = Schema.TaggedStruct("DragonGiven", { seat: Seat, to: Seat });
export type DragonGiven = typeof DragonGiven.Type;

export const KernelEvent = Schema.Union([Played, Passed, SeatFinished, TrickWon, DragonGiven]);
export type KernelEvent = typeof KernelEvent.Type;
