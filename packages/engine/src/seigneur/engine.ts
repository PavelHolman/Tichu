import { Effect, Random } from "effect";
import {
  buildDeck,
  cardKey,
  removeCards,
  sortCards,
  type Card,
  type DeckSpec,
} from "../kernel/cards.ts";
import type { Reactions } from "../kernel/choices.ts";
import type { KernelOptions } from "../kernel/combination.ts";
import { violation, type RuleViolation } from "../kernel/errors.ts";
import { individualLayout, type Seat } from "../kernel/layout.ts";
import {
  bombReactions,
  evolveKernel,
  holders,
  legalPlays,
  makeKernel,
  trickClosed,
  topPlay,
  validatePass,
  validatePlay,
} from "../kernel/trick.ts";
import type {
  ForcedPair,
  SeigneurCommand,
  SeigneurDecision,
  SeigneurEvent,
  SeigneurObservation,
  SeigneurRound,
  SeigneurSettings,
  SeigneurState,
} from "./model.ts";

export const seigneurKernelOptions: KernelOptions = {
  quadBombNeedsDistinctSuits: true,
  laterDragonWins: true,
};

const deckFor = (settings: SeigneurSettings): DeckSpec => ({
  copies: settings.decks,
  withDog: false,
  mahJongs: 1,
});

const replaceAt = <A>(items: ReadonlyArray<A>, index: number, value: A): Array<A> =>
  items.map((item, i) => (i === index ? value : item));

/** "Best" for the forced Exchange: Dragon, Phoenix, Mah Jong, then Ace down to 2. */
export const bestCardValue = (card: Card): number => {
  switch (card._tag) {
    case "Dragon":
      return 17;
    case "Phoenix":
      return 16;
    case "MahJong":
      return 15;
    case "Normal":
      return card.rank;
    case "Dog":
      return 0;
  }
};

const byBest = (cards: ReadonlyArray<Card>) =>
  cards.toSorted((a, b) => bestCardValue(b) - bestCardValue(a));

/** Play order from a hierarchy: the Great Lord, then the Wretch, then up to the Lord. */
export const playOrder = (hierarchy: ReadonlyArray<Seat>): Array<Seat> => {
  const [greatLord, ...rest] = hierarchy;
  return greatLord === undefined ? [] : [greatLord, ...rest.toReversed()];
};

/** Forced pairings: rank n-k+1 gives rank k its best cards, 3/2/1 (2/1/0 with five Seats). */
export const forcedPairs = (hierarchy: ReadonlyArray<Seat>): Array<ForcedPair> => {
  const amounts = hierarchy.length === 5 ? [2, 1, 0] : [3, 2, 1];
  return amounts.flatMap((count, k) => {
    const to = hierarchy[k];
    const from = hierarchy[hierarchy.length - 1 - k];
    return count === 0 || to === undefined || from === undefined ? [] : [{ from, to, count }];
  });
};

export const emptySeigneurState = (settings: SeigneurSettings): SeigneurState => ({
  variant: "grandSeigneur",
  layout: individualLayout(settings.seats),
  settings,
  hierarchy: null,
  round: null,
});

const withKernel = (round: SeigneurRound, kernel: SeigneurRound["kernel"]): SeigneurRound => ({
  ...round,
  kernel,
});

const mahJongHolder = (hands: ReadonlyArray<ReadonlyArray<Card>>): Seat | null => {
  const seat = hands.findIndex((hand) => hand.some((card) => card._tag === "MahJong"));
  return seat === -1 ? null : seat;
};

/** Moves each pair's cards from one Seat to the other. */
const transfer = (
  hands: ReadonlyArray<ReadonlyArray<Card>>,
  moves: ReadonlyArray<{
    readonly from: Seat;
    readonly to: Seat;
    readonly cards: ReadonlyArray<Card>;
  }>,
): Array<Array<Card>> => {
  const next = hands.map((hand) => [...hand]);
  for (const move of moves) next[move.from] = removeCards(next[move.from] ?? [], move.cards) ?? [];
  for (const move of moves) next[move.to] = [...(next[move.to] ?? []), ...move.cards];
  return next;
};

export const evolve = (state: SeigneurState | null, event: SeigneurEvent): SeigneurState => {
  if (event._tag === "GrandSeigneurStarted") return emptySeigneurState(event.settings);
  // Every other event follows `GrandSeigneurStarted`.
  const current = state as SeigneurState;
  const round = current.round;
  switch (event._tag) {
    case "CardsDealt": {
      const pairs = current.hierarchy === null ? [] : forcedPairs(current.hierarchy);
      const giving = pairs.length > 0;
      return {
        ...current,
        round: {
          number: event.round,
          phase: giving ? "giving" : "playing",
          pairs,
          gifts: event.hands.map(() => null),
          returns: event.hands.map(() => null),
          kernel: makeKernel({
            layout: current.layout,
            options: seigneurKernelOptions,
            dragonGift: false,
            hands: event.hands,
            order: event.order,
            turn: giving ? null : mahJongHolder(event.hands),
          }),
        },
      };
    }
    case "BestCardsGiven":
      if (round === null) return current;
      return {
        ...current,
        round: { ...round, gifts: replaceAt(round.gifts, event.seat, event.cards) },
      };
    case "GiftsRevealed": {
      if (round === null) return current;
      const hands = transfer(
        round.kernel.hands,
        round.pairs.map((pair) => ({
          from: pair.from,
          to: pair.to,
          cards: round.gifts[pair.from] ?? [],
        })),
      );
      return {
        ...current,
        round: withKernel({ ...round, phase: "returning" }, { ...round.kernel, hands }),
      };
    }
    case "CardsReturned":
      if (round === null) return current;
      return {
        ...current,
        round: { ...round, returns: replaceAt(round.returns, event.seat, event.cards) },
      };
    case "ReturnsRevealed": {
      if (round === null) return current;
      const hands = transfer(
        round.kernel.hands,
        round.pairs.map((pair) => ({
          from: pair.to,
          to: pair.from,
          cards: round.returns[pair.to] ?? [],
        })),
      );
      return {
        ...current,
        round: withKernel(
          { ...round, phase: "playing" },
          { ...round.kernel, hands, turn: mahJongHolder(hands) },
        ),
      };
    }
    case "Played":
    case "Passed":
    case "SeatFinished":
    case "TrickWon":
      if (round === null) return current;
      return { ...current, round: withKernel(round, evolveKernel(round.kernel, event)) };
    case "HierarchySet":
      return {
        ...current,
        hierarchy: event.finishingOrder,
        round: round === null ? null : { ...round, phase: "ended" },
      };
  }
};

export const replay = (
  events: Iterable<SeigneurEvent>,
  from: SeigneurState | null = null,
): SeigneurState => {
  let state = from;
  for (const event of events) state = evolve(state, event);
  return state as SeigneurState;
};

class Emitter {
  readonly events: Array<SeigneurEvent> = [];
  constructor(public state: SeigneurState) {}
  emit(event: SeigneurEvent): void {
    this.events.push(event);
    this.state = evolve(this.state, event);
  }
  get round(): SeigneurRound {
    return this.state.round as SeigneurRound;
  }
}

/**
 * Deals the Deck one card at a time, starting after the head of the play order: from the Wretch
 * in a hierarchy Round, so the lowest ranks hold any extra cards.
 */
export const dealRound = (state: SeigneurState, number: number) =>
  Effect.gen(function* () {
    const deck = yield* Random.shuffle(buildDeck(deckFor(state.settings)));
    const order =
      state.hierarchy === null
        ? Array.from({ length: state.layout.seats }, (_, seat) => seat)
        : playOrder(state.hierarchy);
    const sequence = state.hierarchy === null ? order : [...order.slice(1), ...order.slice(0, 1)];
    const hands: Array<Array<Card>> = Array.from({ length: state.layout.seats }, () => []);
    deck.forEach((card, index) => {
      hands[sequence[index % sequence.length] ?? 0]?.push(card);
    });
    return { _tag: "CardsDealt", round: number, order, hands } as const;
  });

export const start = (settings: SeigneurSettings) =>
  Effect.gen(function* () {
    const started = {
      _tag: "GrandSeigneurStarted",
      layout: individualLayout(settings.seats),
      settings,
    } as const;
    const dealt = yield* dealRound(evolve(null, started), 1);
    return [started, dealt] satisfies Array<SeigneurEvent>;
  });

const distinctHeld = (hand: ReadonlyArray<Card>, cards: ReadonlyArray<Card>): boolean =>
  new Set(cards.map(cardKey)).size === cards.length && removeCards(hand, cards) !== undefined;

const bestValues = (cards: ReadonlyArray<Card>) =>
  cards
    .map(bestCardValue)
    .toSorted((a, b) => b - a)
    .join(",");

/** Ends the Round once one Seat holds cards, then deals the next. */
const settle = (out: Emitter) =>
  Effect.gen(function* () {
    const round = out.round;
    if (round.phase !== "playing") return;
    const remaining = holders(round.kernel);
    if (remaining.length > 1) return;
    const finishingOrder = [...round.kernel.finished, ...remaining];
    out.emit({ _tag: "HierarchySet", round: round.number, finishingOrder });
    out.emit(yield* dealRound(out.state, round.number + 1));
  });

export const decide = (
  state: SeigneurState,
  command: SeigneurCommand,
): Effect.Effect<ReadonlyArray<SeigneurEvent>, RuleViolation> =>
  Effect.gen(function* () {
    const round = state.round;
    if (round === null || round.phase === "ended") {
      return yield* violation("WrongPhase", "No Round is in progress");
    }
    const { seat } = command;
    if (!Number.isInteger(seat) || seat < 0 || seat >= state.layout.seats) {
      return yield* violation("NotYourTurn", "No such Seat");
    }
    const out = new Emitter(state);
    const hand = round.kernel.hands[seat] ?? [];
    switch (command._tag) {
      case "GiveBest": {
        if (round.phase !== "giving") return yield* violation("WrongPhase", "Not giving cards now");
        const pair = round.pairs.find((candidate) => candidate.from === seat);
        if (pair === undefined) return yield* violation("NotYourTurn", "This Seat gives nothing");
        if (round.gifts[seat] !== null) return yield* violation("AlreadyDecided", "Already given");
        const best = byBest(hand).slice(0, pair.count);
        if (
          command.cards.length !== pair.count ||
          !distinctHeld(hand, command.cards) ||
          bestValues(command.cards) !== bestValues(best)
        ) {
          return yield* violation("InvalidExchange", `Give your ${pair.count} best cards`);
        }
        out.emit({ _tag: "BestCardsGiven", seat, to: pair.to, cards: command.cards });
        if (out.round.pairs.every((each) => out.round.gifts[each.from] !== null)) {
          out.emit({ _tag: "GiftsRevealed" });
        }
        break;
      }
      case "ReturnCards": {
        if (round.phase !== "returning")
          return yield* violation("WrongPhase", "Not returning cards now");
        const pair = round.pairs.find((candidate) => candidate.to === seat);
        if (pair === undefined) return yield* violation("NotYourTurn", "This Seat returns nothing");
        if (round.returns[seat] !== null)
          return yield* violation("AlreadyDecided", "Already returned");
        if (command.cards.length !== pair.count || !distinctHeld(hand, command.cards)) {
          return yield* violation("InvalidExchange", `Return ${pair.count} cards from your Hand`);
        }
        out.emit({ _tag: "CardsReturned", seat, to: pair.from, cards: command.cards });
        if (out.round.pairs.every((each) => out.round.returns[each.to] !== null)) {
          out.emit({ _tag: "ReturnsRevealed" });
        }
        break;
      }
      case "Play": {
        if (round.phase !== "playing") return yield* violation("WrongPhase", "Not playing now");
        out.emit(yield* validatePlay(round.kernel, command));
        if ((out.round.kernel.hands[seat]?.length ?? 0) === 0) {
          out.emit({ _tag: "SeatFinished", seat, place: out.round.kernel.finished.length + 1 });
        }
        yield* settle(out);
        break;
      }
      case "Pass": {
        if (round.phase !== "playing") return yield* violation("WrongPhase", "Not playing now");
        out.emit(yield* validatePass(round.kernel, seat));
        const top = topPlay(out.round.kernel);
        if (trickClosed(out.round.kernel) && top !== undefined) {
          out.emit({ _tag: "TrickWon", seat: top.seat });
        }
        break;
      }
    }
    return out.events;
  });

export const pendingDecisions = (state: SeigneurState): ReadonlyArray<SeigneurDecision> => {
  const round = state.round;
  if (round === null) return [];
  const { number, kernel } = round;
  switch (round.phase) {
    case "giving":
      return round.pairs.flatMap((pair) =>
        round.gifts[pair.from] === null
          ? [
              {
                _tag: "ForcedGive",
                id: `forcedGive:${number}:${pair.from}`,
                seat: pair.from,
                to: pair.to,
                count: pair.count,
                suggested: byBest(kernel.hands[pair.from] ?? []).slice(0, pair.count),
              },
            ]
          : [],
      );
    case "returning":
      return round.pairs.flatMap((pair) =>
        round.returns[pair.to] === null
          ? [
              {
                _tag: "ReturnCards",
                id: `returnCards:${number}:${pair.to}`,
                seat: pair.to,
                to: pair.from,
                count: pair.count,
              },
            ]
          : [],
      );
    case "playing": {
      if (kernel.turn === null) return [];
      const choice = legalPlays(kernel, kernel.turn);
      return [
        {
          _tag: "Play",
          id: `play:${number}:${kernel.actions}`,
          seat: kernel.turn,
          plays: choice.plays,
          canPass: choice.canPass,
        },
      ];
    }
    case "ended":
      return [];
  }
};

export const reactions = (state: SeigneurState, seat: Seat): Reactions => ({
  callTichu: false,
  bombs: state.round?.phase === "playing" ? bombReactions(state.round.kernel, seat) : [],
});

export const observe = (state: SeigneurState, seat: Seat): SeigneurObservation => {
  const round = state.round;
  const base = {
    variant: "grandSeigneur",
    seat,
    layout: state.layout,
    settings: state.settings,
    hierarchy: state.hierarchy,
    decision: pendingDecisions(state).find((pending) => pending.seat === seat) ?? null,
    reactions: reactions(state, seat),
  } as const;
  if (round === null) return { ...base, round: null };
  const { kernel } = round;
  const giftsOpen = round.phase === "giving";
  const returnsOpen = round.phase === "returning";
  const asGiver = round.pairs.find((pair) => pair.from === seat);
  const asRecipient = round.pairs.find((pair) => pair.to === seat);
  const given = [
    ...(asGiver ? (round.gifts[seat] ?? []) : []),
    ...(asRecipient ? (round.returns[seat] ?? []) : []),
  ];
  const received = [
    ...(asRecipient && !giftsOpen ? (round.gifts[asRecipient.from] ?? []) : []),
    ...(asGiver && !giftsOpen && !returnsOpen ? (round.returns[asGiver.to] ?? []) : []),
  ];
  return {
    ...base,
    round: {
      number: round.number,
      phase: round.phase,
      order: kernel.order,
      hand: sortCards(kernel.hands[seat] ?? []),
      handCounts: kernel.hands.map((hand) => hand.length),
      pairs: round.pairs,
      submitted: kernel.hands.map((_, other) =>
        giftsOpen
          ? round.gifts[other] !== null
          : returnsOpen
            ? round.returns[other] !== null
            : false,
      ),
      given,
      received,
      trick: kernel.trick,
      turn: kernel.turn,
      wish: kernel.wish,
      finished: kernel.finished,
    },
  };
};

/** Forced gifts and returns stay private until revealed; everything else is public. */
export const redact = (event: SeigneurEvent, seat: Seat): SeigneurEvent => {
  switch (event._tag) {
    case "CardsDealt":
      return { ...event, hands: event.hands.map((hand, other) => (other === seat ? hand : [])) };
    case "BestCardsGiven":
    case "CardsReturned":
      return event.seat === seat ? event : { ...event, cards: [] };
    default:
      return event;
  }
};

/** Grand Seigneur: five to twelve individuals, a hierarchy, no scoring, open-ended. */
export const seigneur = {
  variant: "grandSeigneur",
  start,
  evolve,
  replay,
  decide,
  pendingDecisions,
  reactions,
  observe,
  redact,
  playOrder,
} as const;
