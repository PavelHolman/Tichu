import { Effect, Schema } from "effect";
import { Card, Rank, cardKey, removeCards, type Card as CardType } from "./cards.ts";
import { Combination, beats, classify, type KernelOptions, type PlayCards } from "./combination.ts";
import { combinationsInHand, type CombinationOption } from "./enumerate.ts";
import { violation, type RuleViolation } from "./errors.ts";
import type { DragonGiven, KernelEvent, Passed, Played } from "./events.ts";
import { Seat, opponentsOf, partnerOf, type Layout } from "./layout.ts";

export const TrickEntry = Schema.Union([
  Schema.TaggedStruct("Play", {
    seat: Seat,
    cards: Schema.Array(Card),
    combination: Combination,
  }),
  Schema.TaggedStruct("Pass", { seat: Seat }),
]);
export type TrickEntry = typeof TrickEntry.Type;

/** The trick-taking part of a Round, shared by every Variant. */
export interface KernelState {
  readonly layout: Layout;
  readonly options: KernelOptions;
  readonly dragonGift: boolean;
  /** Play order of the Round: every Seat once, the next Seat after each. */
  readonly order: ReadonlyArray<Seat>;
  readonly hands: ReadonlyArray<ReadonlyArray<CardType>>;
  /** Plays and Passes on the open Trick, oldest first. */
  readonly trick: ReadonlyArray<TrickEntry>;
  /** Seats that passed since the last Play. */
  readonly passes: ReadonlyArray<Seat>;
  readonly turn: Seat | null;
  readonly wish: Rank | null;
  readonly finished: ReadonlyArray<Seat>;
  /** Cards collected from Tricks, per Seat. */
  readonly won: ReadonlyArray<ReadonlyArray<CardType>>;
  readonly pendingGift: { readonly seat: Seat; readonly cards: ReadonlyArray<CardType> } | null;
  readonly playedCard: ReadonlyArray<boolean>;
  /** Counts Plays, Passes and Trick closings, so a pending Play Decision has a stable id. */
  readonly actions: number;
}

export interface KernelSetup {
  readonly layout: Layout;
  readonly options: KernelOptions;
  readonly dragonGift: boolean;
  readonly hands: ReadonlyArray<ReadonlyArray<CardType>>;
  readonly turn: Seat | null;
  /** Defaults to Seat 0 upward. */
  readonly order?: ReadonlyArray<Seat>;
}

export const makeKernel = (setup: KernelSetup): KernelState => ({
  ...setup,
  order: setup.order ?? Array.from({ length: setup.layout.seats }, (_, seat) => seat),
  trick: [],
  passes: [],
  wish: null,
  finished: [],
  won: setup.hands.map(() => []),
  pendingGift: null,
  playedCard: setup.hands.map(() => false),
  actions: 0,
});

const replaceAt = <A>(items: ReadonlyArray<A>, index: number, value: A): Array<A> =>
  items.map((item, i) => (i === index ? value : item));

export const holds = (state: KernelState, seat: Seat): boolean =>
  (state.hands[seat]?.length ?? 0) > 0;

export const holders = (state: KernelState): Array<Seat> =>
  state.hands.flatMap((hand, seat) => (hand.length > 0 ? [seat] : []));

/** The first Seat after `seat` in play order (or `seat` itself when `inclusive`) that holds cards. */
const nextHolder = (state: KernelState, seat: Seat, inclusive = false): Seat | null => {
  const start = state.order.indexOf(seat);
  for (let offset = inclusive ? 0 : 1; offset < state.order.length; offset++) {
    const candidate = state.order[(start + offset) % state.order.length];
    if (candidate !== undefined && holds(state, candidate)) return candidate;
  }
  return null;
};

/** The Seat that leads after `seat` won a Trick: itself if it still holds cards, else the next holder. */
const leadFrom = (state: KernelState, seat: Seat): Seat | null => nextHolder(state, seat, true);

export const topPlay = (state: KernelState): Extract<TrickEntry, { _tag: "Play" }> | undefined => {
  for (let index = state.trick.length - 1; index >= 0; index--) {
    const entry = state.trick[index];
    if (entry?._tag === "Play") return entry;
  }
  return undefined;
};

const containsRank = (cards: ReadonlyArray<CardType>, rank: Rank): boolean =>
  cards.some((card) => card._tag === "Normal" && card.rank === rank);

export const evolveKernel = (state: KernelState, event: KernelEvent): KernelState => {
  switch (event._tag) {
    case "Played": {
      const hand = removeCards(state.hands[event.seat] ?? [], event.cards) ?? [];
      const hands = replaceAt(state.hands, event.seat, hand);
      const afterHands = { ...state, hands };
      const wishCleared =
        state.wish !== null && containsRank(event.cards, state.wish) ? null : state.wish;
      const wish = event.wish ?? wishCleared;
      const base = {
        ...afterHands,
        wish,
        playedCard: replaceAt(state.playedCard, event.seat, true),
        actions: state.actions + 1,
      };
      if (event.combination.type === "dog") {
        const partner = partnerOf(state.layout, event.seat) ?? event.seat;
        return {
          ...base,
          trick: [],
          passes: [],
          won: replaceAt(state.won, event.seat, [...(state.won[event.seat] ?? []), ...event.cards]),
          turn: leadFrom(afterHands, partner),
        };
      }
      return {
        ...base,
        trick: [
          ...state.trick,
          { _tag: "Play", seat: event.seat, cards: event.cards, combination: event.combination },
        ],
        passes: [],
        turn: nextHolder(afterHands, event.seat),
      };
    }
    case "Passed":
      return {
        ...state,
        trick: [...state.trick, { _tag: "Pass", seat: event.seat }],
        passes: [...state.passes, event.seat],
        turn: nextHolder(state, event.seat),
        actions: state.actions + 1,
      };
    case "SeatFinished":
      return { ...state, finished: [...state.finished, event.seat] };
    case "TrickWon": {
      const cards = state.trick.flatMap((entry) => (entry._tag === "Play" ? entry.cards : []));
      const top = topPlay(state);
      const closed = { ...state, trick: [], passes: [], actions: state.actions + 1 };
      if (state.dragonGift && top !== undefined && isDragonSingle(top.cards)) {
        return { ...closed, pendingGift: { seat: event.seat, cards }, turn: null };
      }
      return {
        ...closed,
        won: replaceAt(state.won, event.seat, [...(state.won[event.seat] ?? []), ...cards]),
        turn: leadFrom(state, event.seat),
      };
    }
    case "DragonGiven": {
      const cards = state.pendingGift?.cards ?? [];
      return {
        ...state,
        won: replaceAt(state.won, event.to, [...(state.won[event.to] ?? []), ...cards]),
        pendingGift: null,
        turn: leadFrom(state, event.seat),
        actions: state.actions + 1,
      };
    }
  }
};

const isDragonSingle = (cards: ReadonlyArray<CardType>): boolean =>
  cards.length === 1 && cards[0]?._tag === "Dragon";

/** Re-classifies a lead option against the open Trick; undefined if it cannot be laid on it. */
const againstTrick = (
  state: KernelState,
  option: CombinationOption,
): CombinationOption | undefined => {
  const top = topPlay(state)?.combination;
  if (top === undefined) return option;
  const combination = classify(option, top, state.options);
  if (combination === undefined || !beats(combination, top, state.options)) return undefined;
  return { ...option, combination };
};

/** What the Seat on turn may do: the Combinations it may lay and whether it may Pass. */
export interface PlayChoice {
  readonly plays: ReadonlyArray<CombinationOption>;
  readonly canPass: boolean;
}

/** The single source of legality for the Seat on turn, with the Wish applied. */
export const legalPlays = (state: KernelState, seat: Seat): PlayChoice => {
  if (state.turn !== seat || state.pendingGift !== null) return { plays: [], canPass: false };
  const hand = state.hands[seat] ?? [];
  const plays = combinationsInHand(hand, state.options).flatMap((option) => {
    const laid = againstTrick(state, option);
    return laid === undefined ? [] : [laid];
  });
  const leading = topPlay(state) === undefined;
  const wish = state.wish;
  if (wish !== null) {
    const honouring = plays.filter((option) => containsRank(option.cards, wish));
    if (honouring.length > 0) return { plays: honouring, canPass: false };
  }
  return { plays, canPass: !leading };
};

/** Bombs a Seat not on turn may lay out of turn on the open Trick. */
export const bombReactions = (state: KernelState, seat: Seat): ReadonlyArray<CombinationOption> => {
  if (state.turn === seat || state.turn === null || state.pendingGift !== null) return [];
  if (topPlay(state) === undefined || !holds(state, seat)) return [];
  return combinationsInHand(state.hands[seat] ?? [], state.options).flatMap((option) => {
    if (option.combination.type !== "bomb") return [];
    const laid = againstTrick(state, option);
    return laid === undefined ? [] : [laid];
  });
};

export interface KernelPlay extends PlayCards {
  readonly seat: Seat;
  readonly wish?: Rank;
}

/** Validates a Play, in turn or as an out-of-turn Bomb, and returns the event it produces. */
export const validatePlay = (
  state: KernelState,
  command: KernelPlay,
): Effect.Effect<Played, RuleViolation> =>
  Effect.gen(function* () {
    const { seat } = command;
    if (state.pendingGift !== null) {
      return yield* violation("WrongPhase", "The Dragon Gift must be made first");
    }
    const hand = state.hands[seat] ?? [];
    const unique = new Set(command.cards.map(cardKey)).size;
    if (unique !== command.cards.length || removeCards(hand, command.cards) === undefined) {
      return yield* violation("CardsNotInHand", "Those cards are not in the Hand");
    }
    const top = topPlay(state)?.combination;
    const combination = classify(command, top, state.options);
    if (combination === undefined) {
      return yield* violation("NotACombination", "Those cards form no Combination");
    }
    if (state.turn !== seat) {
      if (combination.type !== "bomb" || top === undefined || state.turn === null) {
        return yield* violation(
          "NotYourTurn",
          "Only a Bomb on an open Trick may be played out of turn",
        );
      }
    }
    if (top !== undefined && !beats(combination, top, state.options)) {
      return yield* violation("DoesNotBeat", "That Combination does not beat the Trick");
    }
    const hasMahJong = command.cards.some((card) => card._tag === "MahJong");
    if (command.wish !== undefined && !hasMahJong) {
      return yield* violation("InvalidWish", "Only a Play with the Mah Jong may make a Wish");
    }
    const wish = state.wish;
    if (state.turn === seat && wish !== null && !containsRank(command.cards, wish)) {
      if (legalPlays(state, seat).plays.some((option) => containsRank(option.cards, wish))) {
        return yield* violation("WishNotHonoured", "A Play containing the wished rank is required");
      }
    }
    const played: Played = {
      _tag: "Played",
      seat,
      cards: command.cards,
      combination,
      ...(command.phoenixAs === undefined ? {} : { phoenixAs: command.phoenixAs }),
      ...(command.wish === undefined ? {} : { wish: command.wish }),
    };
    return played;
  });

export const validatePass = (
  state: KernelState,
  seat: Seat,
): Effect.Effect<Passed, RuleViolation> =>
  Effect.gen(function* () {
    if (state.turn !== seat) return yield* violation("NotYourTurn", "It is not this Seat's turn");
    const choice = legalPlays(state, seat);
    if (!choice.canPass) {
      return yield* topPlay(state) === undefined
        ? violation("PassNotAllowed", "A lead cannot be passed")
        : violation("WishNotHonoured", "The Wish must be honoured instead of passing");
    }
    return { _tag: "Passed", seat } as const;
  });

/** After a Pass: every holder other than the last to Play has passed. */
export const trickClosed = (state: KernelState): boolean => {
  const top = topPlay(state);
  if (top === undefined) return false;
  return holders(state)
    .filter((seat) => seat !== top.seat)
    .every((seat) => state.passes.includes(seat));
};

/** The recipient when the Dragon Gift cannot change the score: every opponent is out. */
export const automaticGiftRecipient = (state: KernelState): Seat | undefined => {
  if (state.pendingGift === null) return undefined;
  const opponents = opponentsOf(state.layout, state.pendingGift.seat);
  return opponents.every((seat) => !holds(state, seat)) ? opponents[0] : undefined;
};

export const giftRecipients = (state: KernelState): ReadonlyArray<Seat> =>
  state.pendingGift === null ? [] : opponentsOf(state.layout, state.pendingGift.seat);

export const validateGift = (
  state: KernelState,
  seat: Seat,
  to: Seat,
): Effect.Effect<DragonGiven, RuleViolation> =>
  Effect.gen(function* () {
    if (state.pendingGift === null || state.pendingGift.seat !== seat) {
      return yield* violation("WrongPhase", "No Dragon Gift is pending for this Seat");
    }
    if (!giftRecipients(state).includes(to)) {
      return yield* violation("InvalidRecipient", "The Dragon's Trick goes to an opponent");
    }
    return { _tag: "DragonGiven", seat, to } as const;
  });
