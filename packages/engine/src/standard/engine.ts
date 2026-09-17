import { Effect, Random } from "effect";
import {
  buildDeck,
  cardKey,
  removeCards,
  sortCards,
  standardDeck,
  sumPoints,
  type Card,
} from "../kernel/cards.ts";
import { standardKernelOptions } from "../kernel/combination.ts";
import { violation, type RuleViolation } from "../kernel/errors.ts";
import {
  areTeammates,
  fourSeatsTwoTeams,
  opponentsOf,
  seatsInOrderAfter,
  teamOf,
  type Seat,
} from "../kernel/layout.ts";
import {
  automaticGiftRecipient,
  bombReactions,
  evolveKernel,
  giftRecipients,
  holders,
  legalPlays,
  makeKernel,
  topPlay,
  trickClosed,
  validateGift,
  validatePass,
  validatePlay,
  type KernelState,
} from "../kernel/trick.ts";
import {
  FIRST_STAGE,
  defaultStandardSettings,
  type CallKind,
  type CallResult,
  type Decision,
  type Give,
  type Observation,
  type Reactions,
  type RoundEnded,
  type StandardCommand,
  type StandardEvent,
  type StandardRound,
  type StandardSettings,
  type StandardState,
} from "./model.ts";

const replaceAt = <A>(items: ReadonlyArray<A>, index: number, value: A): Array<A> =>
  items.map((item, i) => (i === index ? value : item));

export const emptyStandardState: StandardState = {
  layout: fourSeatsTwoTeams,
  settings: defaultStandardSettings,
  totals: [0, 0],
  round: null,
  lastRound: null,
  winningTeam: null,
};

const withKernel = (round: StandardRound, kernel: KernelState): StandardRound => ({
  ...round,
  kernel,
});

const mahJongHolder = (hands: ReadonlyArray<ReadonlyArray<Card>>): Seat | null => {
  const seat = hands.findIndex((hand) => hand.some((card) => card._tag === "MahJong"));
  return seat === -1 ? null : seat;
};

export const evolve = (state: StandardState, event: StandardEvent): StandardState => {
  const round = state.round;
  switch (event._tag) {
    case "MatchStarted":
      return {
        ...emptyStandardState,
        layout: event.layout,
        settings: event.settings,
        totals: event.layout.teams.map(() => 0),
      };
    case "RoundDealt":
      return {
        ...state,
        round: {
          number: event.round,
          phase: "grandTichu",
          dealt: event.hands,
          grandTichu: event.hands.map(() => null),
          calls: event.hands.map(() => "none"),
          exchanges: event.hands.map(() => null),
          kernel: makeKernel({
            layout: state.layout,
            options: standardKernelOptions,
            dragonGift: true,
            hands: event.hands.map((hand) => hand.slice(0, FIRST_STAGE)),
            turn: null,
          }),
        },
      };
    case "GrandTichuDecided":
      if (round === null) return state;
      return {
        ...state,
        round: {
          ...round,
          grandTichu: replaceAt(round.grandTichu, event.seat, event.call),
          calls: event.call ? replaceAt(round.calls, event.seat, "grandTichu") : round.calls,
        },
      };
    case "RemainingCardsDealt":
      if (round === null) return state;
      return {
        ...state,
        round: withKernel({ ...round, phase: "exchange" }, { ...round.kernel, hands: round.dealt }),
      };
    case "TichuCalled":
      if (round === null) return state;
      return { ...state, round: { ...round, calls: replaceAt(round.calls, event.seat, "tichu") } };
    case "ExchangeSubmitted":
      if (round === null) return state;
      return {
        ...state,
        round: { ...round, exchanges: replaceAt(round.exchanges, event.seat, event.gives) },
      };
    case "ExchangeCompleted": {
      if (round === null) return state;
      const hands = round.kernel.hands.map((hand, seat) => {
        const kept = removeCards(
          hand,
          (round.exchanges[seat] ?? []).map((give) => give.card),
        );
        const received = round.exchanges.flatMap((gives) =>
          (gives ?? []).filter((give) => give.to === seat).map((give) => give.card),
        );
        return [...(kept ?? hand), ...received];
      });
      return {
        ...state,
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
    case "DragonGiven":
      if (round === null) return state;
      return { ...state, round: withKernel(round, evolveKernel(round.kernel, event)) };
    case "RoundEnded":
      return {
        ...state,
        totals: event.totals,
        lastRound: event,
        round: round === null ? null : { ...round, phase: "ended" },
      };
    case "MatchEnded":
      return { ...state, winningTeam: event.winningTeam };
  }
};

/**
 * Folds events onto a Match state. A search Bot rebuilds a hypothetical Round by folding a guessed
 * `RoundDealt` and then the Round's public events.
 */
export const replay = (
  events: Iterable<StandardEvent>,
  from: StandardState = emptyStandardState,
): StandardState => {
  let state = from;
  for (const event of events) state = evolve(state, event);
  return state;
};

/** Collects events while keeping the folded state current, so later rules see earlier events. */
class Emitter {
  readonly events: Array<StandardEvent> = [];
  constructor(public state: StandardState) {}
  emit(event: StandardEvent): void {
    this.events.push(event);
    this.state = evolve(this.state, event);
  }
  get round(): StandardRound {
    // Every command handler checks for a Round before emitting.
    return this.state.round as StandardRound;
  }
}

/** Shuffles and deals a Round. */
export const dealRound = (state: StandardState, number: number) =>
  Effect.gen(function* () {
    const deck = yield* Random.shuffle(buildDeck(standardDeck));
    const perSeat = deck.length / state.layout.seats;
    const hands = Array.from({ length: state.layout.seats }, (_, seat) =>
      deck.slice(seat * perSeat, (seat + 1) * perSeat),
    );
    return { _tag: "RoundDealt", round: number, hands } as const;
  });

export const start = (settings: StandardSettings = defaultStandardSettings) =>
  Effect.gen(function* () {
    const started = { _tag: "MatchStarted", layout: fourSeatsTwoTeams, settings } as const;
    const dealt = yield* dealRound(evolve(emptyStandardState, started), 1);
    return [started, dealt] satisfies Array<StandardEvent>;
  });

const canCallTichu = (round: StandardRound, seat: Seat): boolean =>
  round.calls[seat] === "none" &&
  round.kernel.playedCard[seat] === false &&
  ((round.phase === "exchange" && round.exchanges[seat] === null) || round.phase === "playing");

const scoreRound = (state: StandardState, round: StandardRound): RoundEnded => {
  const { layout } = state;
  const kernel = round.kernel;
  const finishingOrder = [
    ...kernel.finished,
    ...holders(kernel).filter((seat) => !kernel.finished.includes(seat)),
  ];
  const [first, second] = kernel.finished;
  const oneTwo = first !== undefined && second !== undefined && areTeammates(layout, first, second);
  let cardPoints: Array<number>;
  if (oneTwo) {
    cardPoints = layout.teams.map((_, team) => (team === teamOf(layout, first) ? 200 : 0));
  } else {
    const won = kernel.won.map((cards) => [...cards]);
    const tailender = holders(kernel)[0];
    if (tailender !== undefined && first !== undefined) {
      won[first] = [...(won[first] ?? []), ...(won[tailender] ?? [])];
      won[tailender] = [];
      const opponent = opponentsOf(layout, tailender)[0];
      if (opponent !== undefined) {
        won[opponent] = [...(won[opponent] ?? []), ...(kernel.hands[tailender] ?? [])];
      }
    }
    cardPoints = layout.teams.map((team) =>
      team.reduce((total, seat) => total + sumPoints(won[seat] ?? []), 0),
    );
  }
  const calls: Array<CallResult> = round.calls.flatMap((call, seat) => {
    if (call === "none") return [];
    const succeeded = first === seat;
    const value = call === "grandTichu" ? 200 : 100;
    return [{ seat, call, succeeded, points: succeeded ? value : -value }];
  });
  const points = cardPoints.map(
    (value, team) =>
      value +
      calls
        .filter((result) => teamOf(layout, result.seat) === team)
        .reduce((total, result) => total + result.points, 0),
  );
  return {
    _tag: "RoundEnded",
    round: round.number,
    finishingOrder,
    oneTwo,
    cardPoints,
    calls,
    points,
    totals: state.totals.map((total, team) => total + (points[team] ?? 0)),
  };
};

/** The Team that won the Match: at or over the target and strictly ahead of every other Team. */
const matchWinner = (state: StandardState): number | undefined => {
  const best = Math.max(...state.totals);
  if (best < state.settings.targetScore) return undefined;
  const leaders = state.totals.flatMap((total, team) => (total === best ? [team] : []));
  return leaders.length === 1 ? leaders[0] : undefined;
};

/** Collects the open Trick for its winner, making the Dragon Gift when no choice is left. */
const closeTrick = (out: Emitter): void => {
  const top = topPlay(out.round.kernel);
  if (top === undefined) return;
  out.emit({ _tag: "TrickWon", seat: top.seat });
  const gifting = out.round.kernel.pendingGift;
  const automatic = automaticGiftRecipient(out.round.kernel);
  if (gifting !== null && automatic !== undefined) {
    out.emit({ _tag: "DragonGiven", seat: gifting.seat, to: automatic });
  }
};

/** Ends the Round once the rules say so, collecting the last Trick and dealing the next Round. */
const settle = (out: Emitter) =>
  Effect.gen(function* () {
    const round = out.round;
    if (round.phase !== "playing" || round.kernel.pendingGift !== null) return;
    const { finished } = round.kernel;
    const [first, second] = finished;
    const oneTwo =
      first !== undefined && second !== undefined && areTeammates(out.state.layout, first, second);
    if (!oneTwo && holders(round.kernel).length > 1) return;
    if (!oneTwo) {
      closeTrick(out);
      if (out.round.kernel.pendingGift !== null) return;
    }
    out.emit(scoreRound(out.state, out.round));
    const winner = matchWinner(out.state);
    if (winner !== undefined) {
      out.emit({ _tag: "MatchEnded", winningTeam: winner, totals: out.state.totals });
      return;
    }
    out.emit(yield* dealRound(out.state, out.round.number + 1));
  });

const validateExchange = (
  state: StandardState,
  round: StandardRound,
  seat: Seat,
  gives: ReadonlyArray<Give>,
) =>
  Effect.gen(function* () {
    const targets = seatsInOrderAfter(state.layout, seat);
    const recipients = gives.map((give) => give.to);
    const coversEveryone =
      gives.length === targets.length && targets.every((target) => recipients.includes(target));
    const cards = gives.map((give) => give.card);
    const distinct = new Set(cards.map(cardKey)).size === cards.length;
    const held = removeCards(round.kernel.hands[seat] ?? [], cards) !== undefined;
    if (!coversEveryone || !distinct || !held) {
      return yield* violation(
        "InvalidExchange",
        "Give exactly one card from the Hand to each other Seat",
      );
    }
  });

export const decide = (
  state: StandardState,
  command: StandardCommand,
): Effect.Effect<ReadonlyArray<StandardEvent>, RuleViolation> =>
  Effect.gen(function* () {
    if (state.winningTeam !== null) return yield* violation("MatchOver", "The Match is over");
    const round = state.round;
    if (round === null || round.phase === "ended") {
      return yield* violation("WrongPhase", "No Round is in progress");
    }
    const seat = command.seat;
    if (!Number.isInteger(seat) || seat < 0 || seat >= state.layout.seats) {
      return yield* violation("NotYourTurn", "No such Seat");
    }
    const out = new Emitter(state);
    switch (command._tag) {
      case "GrandTichu": {
        if (round.phase !== "grandTichu") {
          return yield* violation("WrongPhase", "The Grand Tichu window is closed");
        }
        if (round.grandTichu[seat] !== null) {
          return yield* violation("AlreadyDecided", "This Seat already decided");
        }
        out.emit({ _tag: "GrandTichuDecided", seat, call: command.call });
        if (out.round.grandTichu.every((decided) => decided !== null)) {
          const grandTichus = out.round.grandTichu.flatMap((call, s) => (call === true ? [s] : []));
          out.emit({ _tag: "RemainingCardsDealt", grandTichus });
        }
        break;
      }
      case "CallTichu": {
        if (!canCallTichu(round, seat)) {
          return yield* violation("CallNotAllowed", "A Tichu cannot be called now");
        }
        out.emit({ _tag: "TichuCalled", seat });
        break;
      }
      case "Exchange": {
        if (round.phase !== "exchange") return yield* violation("WrongPhase", "Not exchanging now");
        if (round.exchanges[seat] !== null) {
          return yield* violation("AlreadyDecided", "This Seat already exchanged");
        }
        yield* validateExchange(state, round, seat, command.gives);
        out.emit({ _tag: "ExchangeSubmitted", seat, gives: command.gives });
        if (out.round.exchanges.every((gives) => gives !== null)) {
          out.emit({ _tag: "ExchangeCompleted" });
        }
        break;
      }
      case "Play": {
        if (round.phase !== "playing") return yield* violation("WrongPhase", "Not playing now");
        const played = yield* validatePlay(round.kernel, command);
        out.emit(played);
        if ((out.round.kernel.hands[seat]?.length ?? 0) === 0) {
          out.emit({ _tag: "SeatFinished", seat, place: out.round.kernel.finished.length + 1 });
        }
        yield* settle(out);
        break;
      }
      case "Pass": {
        if (round.phase !== "playing") return yield* violation("WrongPhase", "Not playing now");
        out.emit(yield* validatePass(round.kernel, seat));
        if (trickClosed(out.round.kernel)) closeTrick(out);
        yield* settle(out);
        break;
      }
      case "GiftDragon": {
        if (round.phase !== "playing") return yield* violation("WrongPhase", "Not playing now");
        out.emit(yield* validateGift(round.kernel, seat, command.to));
        yield* settle(out);
        break;
      }
    }
    return out.events;
  });

/** Every Decision the engine is waiting on, across all Seats. */
export const pendingDecisions = (state: StandardState): ReadonlyArray<Decision> => {
  const round = state.round;
  if (round === null || state.winningTeam !== null) return [];
  const { number, kernel } = round;
  switch (round.phase) {
    case "grandTichu":
      return round.grandTichu.flatMap((decided, seat) =>
        decided === null ? [{ _tag: "GrandTichu", id: `grandTichu:${number}:${seat}`, seat }] : [],
      );
    case "exchange":
      return round.exchanges.flatMap((gives, seat) =>
        gives === null
          ? [
              {
                _tag: "Exchange",
                id: `exchange:${number}:${seat}`,
                seat,
                to: seatsInOrderAfter(state.layout, seat),
              },
            ]
          : [],
      );
    case "playing": {
      if (kernel.pendingGift !== null) {
        const { seat } = kernel.pendingGift;
        return [
          {
            _tag: "DragonGift",
            id: `dragonGift:${number}:${kernel.actions}`,
            seat,
            to: giftRecipients(kernel),
          },
        ];
      }
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

export const reactions = (state: StandardState, seat: Seat): Reactions => {
  const round = state.round;
  if (round === null || state.winningTeam !== null || round.phase === "ended") {
    return { callTichu: false, bombs: [] };
  }
  return {
    callTichu: canCallTichu(round, seat),
    bombs: round.phase === "playing" ? bombReactions(round.kernel, seat) : [],
  };
};

/** Everything a Participant in `seat` may see. */
export const observe = (state: StandardState, seat: Seat): Observation => {
  const round = state.round;
  const decision = pendingDecisions(state).find((pending) => pending.seat === seat) ?? null;
  const base = {
    variant: "standard",
    seat,
    layout: state.layout,
    settings: state.settings,
    totals: state.totals,
    winningTeam: state.winningTeam,
    lastRound: state.lastRound,
    decision,
    reactions: reactions(state, seat),
  } as const;
  if (round === null) return { ...base, round: null };
  const { kernel } = round;
  const windowOpen = round.phase === "grandTichu";
  const exchangeDone = round.phase !== "grandTichu" && round.phase !== "exchange";
  const calls: Array<CallKind> = round.calls.map((call, other) =>
    windowOpen && other !== seat ? "none" : call,
  );
  return {
    ...base,
    round: {
      number: round.number,
      phase: round.phase,
      hand: sortCards(kernel.hands[seat] ?? []),
      handCounts: kernel.hands.map((hand) => hand.length),
      calls,
      decided: windowOpen
        ? round.grandTichu.map((decided) => decided !== null)
        : round.exchanges.map((gives) => gives !== null),
      given: round.exchanges[seat] ?? [],
      received: exchangeDone
        ? round.exchanges.flatMap((gives, from) =>
            (gives ?? [])
              .filter((give) => give.to === seat)
              .map((give) => ({ from, card: give.card })),
          )
        : [],
      trick: kernel.trick,
      turn: kernel.turn,
      wish: kernel.wish,
      finished: kernel.finished,
      wonCounts: kernel.won.map((cards) => cards.length),
      pendingGift: kernel.pendingGift?.seat ?? null,
    },
  };
};

/**
 * The event as `seat` may see it. Returns the event unchanged when it is public. Private parts
 * are replaced: other Seats' cards in a deal, Grand Tichu answers before the window closes, and
 * other Seats' Exchange cards.
 */
export const redact = (event: StandardEvent, seat: Seat): StandardEvent => {
  switch (event._tag) {
    case "RoundDealt":
      return {
        ...event,
        hands: event.hands.map((hand, other) => (other === seat ? hand.slice(0, FIRST_STAGE) : [])),
      };
    case "GrandTichuDecided":
      return event.seat === seat ? event : { ...event, call: false };
    case "ExchangeSubmitted":
      return event.seat === seat ? event : { ...event, gives: [] };
    default:
      return event;
  }
};

/** The standard Tichu Variant: four Seats in two Teams, played to a target score. */
export const standardTichu = {
  variant: "standard",
  empty: emptyStandardState,
  start,
  evolve,
  replay,
  decide,
  pendingDecisions,
  reactions,
  observe,
  redact,
} as const;
