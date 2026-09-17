import {
  WISH_RANKS,
  areTeammates,
  combinationsInHand,
  sameCard,
  type Card,
  type Decision,
  type Observation,
  type PlayOption,
  type StandardCommand,
} from "@tichu/engine";
import { Effect, Random } from "effect";

export type BotTier = "random" | "heuristic";

/**
 * A Bot sees exactly what a human in its Seat sees. Both entry points are pure given the
 * `Random` seed the Table provides.
 */
export interface Bot {
  readonly tier: BotTier;
  /** Answers a Decision the engine requires with one of its legal options. */
  readonly decide: (observation: Observation, decision: Decision) => Effect.Effect<StandardCommand>;
  /** Volunteers a Reaction (a Call or an out-of-turn Bomb), or nothing. */
  readonly react: (observation: Observation) => Effect.Effect<StandardCommand | undefined>;
}

const pick = <A>(items: ReadonlyArray<A>): Effect.Effect<A | undefined> =>
  items.length === 0
    ? Effect.succeed(undefined)
    : Random.nextIntBetween(0, items.length - 1).pipe(Effect.map((index) => items[index]));

const playCommand = (seat: number, option: PlayOption, wish?: number): StandardCommand => ({
  _tag: "Play",
  seat,
  cards: option.cards,
  ...(option.phoenixAs === undefined ? {} : { phoenixAs: option.phoenixAs }),
  ...(wish === undefined ? {} : { wish }),
});

const hand = (observation: Observation): ReadonlyArray<Card> => observation.round?.hand ?? [];

export const randomBot: Bot = {
  tier: "random",
  decide: (observation, decision) =>
    Effect.gen(function* () {
      switch (decision._tag) {
        case "GrandTichu":
          return { _tag: "GrandTichu", seat: decision.seat, call: false };
        case "Exchange": {
          const shuffled = yield* Random.shuffle(hand(observation));
          return {
            _tag: "Exchange",
            seat: decision.seat,
            gives: decision.to.map((to, index) => ({ to, card: shuffled[index] as Card })),
          };
        }
        case "Play": {
          const count = decision.plays.length + (decision.canPass ? 1 : 0);
          const index = yield* Random.nextIntBetween(0, count - 1);
          const option = decision.plays[index];
          return option === undefined
            ? { _tag: "Pass", seat: decision.seat }
            : playCommand(decision.seat, option);
        }
        case "DragonGift":
          return { _tag: "GiftDragon", seat: decision.seat, to: (yield* pick(decision.to)) ?? 0 };
      }
    }),
  react: () => Effect.succeed(undefined),
};

// Heuristic Bot. Thresholds are deliberately simple and tunable.

const GRAND_TICHU_POWER_CARDS = 2;
const TICHU_STRENGTH = 7;

const isPower = (card: Card) =>
  card._tag === "Dragon" || card._tag === "Phoenix" || (card._tag === "Normal" && card.rank === 14);

const cardValue = (card: Card): number => {
  switch (card._tag) {
    case "Dog":
      return 0;
    case "MahJong":
      return 1;
    case "Normal":
      return card.rank;
    case "Phoenix":
      return 14.5;
    case "Dragon":
      return 15;
  }
};

const bombCards = (cards: ReadonlyArray<Card>): ReadonlyArray<Card> =>
  combinationsInHand(cards)
    .filter((option) => option.combination.type === "bomb")
    .flatMap((option) => option.cards);

const handStrength = (cards: ReadonlyArray<Card>): number => {
  const bombs = combinationsInHand(cards).filter((option) => option.combination.type === "bomb");
  return (
    cards.filter((card) => card._tag === "Normal" && card.rank === 14).length +
    cards.filter((card) => card._tag === "Dragon" || card._tag === "Phoenix").length * 2 +
    Math.min(bombs.length, 2) * 3
  );
};

const partnerOf = (observation: Observation): number | undefined => {
  const { layout, seat } = observation;
  return layout.teams.find((team) => team.includes(seat))?.find((other) => other !== seat);
};

const topPlay = (observation: Observation) =>
  observation.round?.trick.findLast((entry) => entry._tag === "Play");

/** Lower is cheaper to spend: rank, with a surcharge for the Phoenix, the Dragon and Bombs. */
const cost = (option: PlayOption): number =>
  option.combination.rank +
  (option.cards.some((card) => card._tag === "Phoenix") ? 6 : 0) +
  (option.cards.some((card) => card._tag === "Dragon") ? 4 : 0) +
  (option.combination.type === "bomb" ? 40 : 0);

const cheapest = (options: ReadonlyArray<PlayOption>): PlayOption | undefined =>
  options.toSorted((a, b) => cost(a) - cost(b))[0];

/**
 * A Bomb is worth spending only around Calls: to break the Call of the opponent winning the Trick,
 * or to stop an opponent winning while our Team's Call is still alive.
 */
const bombWorthy = (observation: Observation): boolean => {
  const round = observation.round;
  const top = topPlay(observation);
  if (round === null || top === undefined) return false;
  const { layout, seat } = observation;
  if (areTeammates(layout, seat, top.seat)) return false;
  const called = (other: number) =>
    round.calls[other] !== "none" && !round.finished.includes(other);
  const team = layout.teams.find((members) => members.includes(seat)) ?? [seat];
  return called(top.seat) || team.some(called);
};

const lead = (
  observation: Observation,
  options: ReadonlyArray<PlayOption>,
): PlayOption | undefined => {
  const round = observation.round;
  const partner = partnerOf(observation);
  const dog = options.find((option) => option.combination.type === "dog");
  if (
    dog !== undefined &&
    partner !== undefined &&
    round !== null &&
    round.calls[partner] !== "none" &&
    !round.finished.includes(partner)
  ) {
    return dog;
  }
  const ordinary = options.filter(
    (option) =>
      option.combination.type !== "bomb" &&
      option.combination.type !== "dog" &&
      !(
        option.cards.length === 1 &&
        option.cards[0]?._tag !== "Normal" &&
        option.cards[0]?._tag !== "MahJong"
      ),
  );
  const pool = ordinary.length > 0 ? ordinary : options;
  // Shed the most low cards: longest first, then lowest.
  return pool.toSorted((a, b) => b.cards.length - a.cards.length || cost(a) - cost(b))[0];
};

const wishFor = (observation: Observation): number => {
  const held = new Set(
    hand(observation).flatMap((card) => (card._tag === "Normal" ? [card.rank] : [])),
  );
  return WISH_RANKS.toReversed().find((rank) => !held.has(rank)) ?? 14;
};

export const heuristicBot: Bot = {
  tier: "heuristic",
  decide: (observation, decision) =>
    Effect.sync((): StandardCommand => {
      const cards = hand(observation);
      switch (decision._tag) {
        case "GrandTichu": {
          const power = cards.filter(isPower).length;
          return {
            _tag: "GrandTichu",
            seat: decision.seat,
            call: power >= GRAND_TICHU_POWER_CARDS,
          };
        }
        case "Exchange": {
          const partner = partnerOf(observation);
          const protectedCards = bombCards(cards);
          const giveable = cards
            .filter((card) => !protectedCards.some((kept) => sameCard(kept, card)))
            .toSorted((a, b) => cardValue(a) - cardValue(b));
          const pool =
            giveable.length >= decision.to.length
              ? giveable
              : cards.toSorted((a, b) => cardValue(a) - cardValue(b));
          const remaining = [...pool];
          const take = (card: Card | undefined) => {
            const index = remaining.findIndex((held) => card !== undefined && sameCard(held, card));
            return index === -1 ? undefined : remaining.splice(index, 1)[0];
          };
          const gives = new Map<number, Card>();
          if (partner !== undefined && decision.to.includes(partner)) {
            const strong = remaining.findLast((card) => card._tag === "Normal") ?? remaining.at(-1);
            const card = take(strong);
            if (card !== undefined) gives.set(partner, card);
          }
          for (const to of decision.to) {
            if (gives.has(to)) continue;
            const card = take(remaining[0]);
            if (card !== undefined) gives.set(to, card);
          }
          return {
            _tag: "Exchange",
            seat: decision.seat,
            gives: decision.to.map((to) => ({ to, card: gives.get(to) as Card })),
          };
        }
        case "Play": {
          const top = topPlay(observation);
          if (top === undefined) {
            const option = lead(observation, decision.plays);
            if (option === undefined) return { _tag: "Pass", seat: decision.seat };
            const hasMahJong = option.cards.some((card) => card._tag === "MahJong");
            return playCommand(
              decision.seat,
              option,
              hasMahJong ? wishFor(observation) : undefined,
            );
          }
          if (decision.canPass && areTeammates(observation.layout, observation.seat, top.seat)) {
            return { _tag: "Pass", seat: decision.seat };
          }
          const ordinary = decision.plays.filter((option) => option.combination.type !== "bomb");
          const bombs = decision.plays.filter((option) => option.combination.type === "bomb");
          const choice =
            cheapest(ordinary) ??
            (bombWorthy(observation) || !decision.canPass ? cheapest(bombs) : undefined);
          return choice === undefined
            ? { _tag: "Pass", seat: decision.seat }
            : playCommand(decision.seat, choice);
        }
        case "DragonGift": {
          const counts = observation.round?.handCounts ?? [];
          const to = decision.to.toSorted((a, b) => (counts[b] ?? 0) - (counts[a] ?? 0))[0] ?? 0;
          return { _tag: "GiftDragon", seat: decision.seat, to };
        }
      }
    }),
  react: (observation) =>
    Effect.sync(() => {
      const round = observation.round;
      if (round === null) return undefined;
      const { reactions, seat } = observation;
      if (reactions.bombs.length > 0 && bombWorthy(observation)) {
        const bomb = cheapest(reactions.bombs);
        if (bomb !== undefined) return playCommand(seat, bomb);
      }
      const nobodyCalled = round.calls.every((call) => call === "none");
      if (
        reactions.callTichu &&
        round.phase === "playing" &&
        nobodyCalled &&
        handStrength(hand(observation)) >= TICHU_STRENGTH
      ) {
        return { _tag: "CallTichu", seat };
      }
      return undefined;
    }),
};

export const bots: Record<BotTier, Bot> = { random: randomBot, heuristic: heuristicBot };
