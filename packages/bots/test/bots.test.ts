import { assert, describe, expect, it } from "@effect/vitest";
import {
  decide,
  emptyStandardState,
  makeKernel,
  normal,
  observe,
  pendingDecisions,
  replay,
  standardKernelOptions,
  start,
  type CallKind,
  type Card,
  type StandardCommand,
  type StandardState,
} from "@tichu/engine";
import { Effect, Random } from "effect";
import { heuristicBot, randomBot, type Bot } from "../src/index.ts";

const suitByLetter = { j: "jade", s: "sword", p: "pagoda", t: "star" } as const;
const cards = (spec: string): Array<Card> =>
  spec
    .split(/\s+/)
    .filter(Boolean)
    .map((token): Card => {
      if (token === "Ph") return { _tag: "Phoenix", copy: 0 };
      if (token === "Dr") return { _tag: "Dragon", copy: 0 };
      if (token === "Mj") return { _tag: "MahJong", copy: 0 };
      if (token === "Dg") return { _tag: "Dog", copy: 0 };
      const rank = { J: 11, Q: 12, K: 13, A: 14 }[token.slice(0, -1)] ?? Number(token.slice(0, -1));
      return normal(suitByLetter[token.slice(-1) as "j"], rank);
    });

const inPlay = (
  hands: ReadonlyArray<string>,
  turn: number,
  calls: ReadonlyArray<CallKind> = ["none", "none", "none", "none"],
): StandardState => {
  const dealt = hands.map(cards);
  return {
    ...emptyStandardState,
    round: {
      number: 1,
      phase: "playing",
      dealt,
      grandTichu: [false, false, false, false],
      calls: [...calls],
      exchanges: [[], [], [], []],
      kernel: makeKernel({
        layout: emptyStandardState.layout,
        options: standardKernelOptions,
        dragonGift: true,
        hands: dealt,
        turn,
      }),
    },
  };
};

const step = (state: StandardState, command: StandardCommand) =>
  decide(state, command).pipe(
    Effect.map((events) => replay(events, state)),
    Effect.orDie,
  );

const answerFor = (bot: Bot, state: StandardState, seat: number) =>
  Effect.gen(function* () {
    const decision = pendingDecisions(state).find((pending) => pending.seat === seat);
    assert.isDefined(decision);
    return yield* bot.decide(observe(state, seat), decision!);
  });

/** Plays a Match between two Teams of Bots and returns the winning Team. */
const playMatch = (seats: ReadonlyArray<Bot>, seed: string, targetScore = 500) =>
  Effect.gen(function* () {
    let state = replay(yield* start({ targetScore }));
    for (let turn = 0; turn < 50_000 && state.winningTeam === null; turn++) {
      for (let seat = 0; seat < 4; seat++) {
        const reaction = yield* seats[seat]!.react(observe(state, seat));
        if (reaction !== undefined) state = yield* step(state, reaction);
      }
      const decision = pendingDecisions(state)[0];
      if (decision === undefined) continue;
      const bot = seats[decision.seat]!;
      state = yield* step(state, yield* bot.decide(observe(state, decision.seat), decision));
    }
    assert.isNotNull(state.winningTeam);
    return state.winningTeam!;
  }).pipe(Random.withSeed(seed));

describe("random Bot", () => {
  it.effect(
    "only ever answers with legal options, through whole Matches",
    () =>
      Effect.gen(function* () {
        for (let seed = 0; seed < 4; seed++) {
          yield* playMatch([randomBot, randomBot, randomBot, randomBot], `random-${seed}`);
        }
      }),
    60_000,
  );
});

describe("heuristic Bot", () => {
  it.effect("calls Grand Tichu with two of the Dragon, the Phoenix and Aces", () =>
    Effect.gen(function* () {
      const state = replay([
        {
          _tag: "MatchStarted",
          layout: emptyStandardState.layout,
          settings: { targetScore: 1000 },
        },
        {
          _tag: "RoundDealt",
          round: 1,
          hands: [
            cards("Dr Aj 2j 3j 4j 5j 6j 7j 8s 9s 10s Js Qs Ks"),
            cards("2s 3s 4s 5s 6s 7s 8j 9j 10j Jj Qj Kj Ph As"),
            cards("2p 3p 4p 5p 6p 7p 8p 9p 10p Jp Qp Kp Ap Mj"),
            cards("2t 3t 4t 5t 6t 7t 8t 9t 10t Jt Qt Kt At Dg"),
          ],
        },
      ]);
      expect(yield* answerFor(heuristicBot, state, 0)).toMatchObject({ call: true });
      expect(yield* answerFor(heuristicBot, state, 2)).toMatchObject({ call: false });
    }),
  );

  it.effect("passes when its partner is winning and otherwise beats as cheaply as it can", () =>
    Effect.gen(function* () {
      const partnerWinning = yield* step(inPlay(["9j 2j", "3s", "Kp Qp", "4t"], 0), {
        _tag: "Play",
        seat: 0,
        cards: cards("9j"),
      });
      const afterPass = yield* step(partnerWinning, { _tag: "Pass", seat: 1 });
      expect(yield* answerFor(heuristicBot, afterPass, 2)).toEqual({ _tag: "Pass", seat: 2 });

      const opponentWinning = yield* step(inPlay(["9j 2j", "Ks 10s Dr", "Kp", "4t"], 0), {
        _tag: "Play",
        seat: 0,
        cards: cards("9j"),
      });
      expect(yield* answerFor(heuristicBot, opponentWinning, 1)).toMatchObject({
        cards: cards("10s"),
      });
    }),
  );

  it.effect("keeps its Bombs unless a Call is at stake", () =>
    Effect.gen(function* () {
      const quiet = yield* step(inPlay(["Aj 2j", "5s 5j 5p 5t", "Kp", "4t"], 0), {
        _tag: "Play",
        seat: 0,
        cards: cards("Aj"),
      });
      expect(yield* answerFor(heuristicBot, quiet, 1)).toEqual({ _tag: "Pass", seat: 1 });

      const called = yield* step(
        inPlay(["Aj 2j", "5s 5j 5p 5t", "Kp", "4t"], 0, ["tichu", "none", "none", "none"]),
        { _tag: "Play", seat: 0, cards: cards("Aj") },
      );
      expect(yield* answerFor(heuristicBot, called, 1)).toMatchObject({
        cards: cards("5s 5j 5p 5t"),
      });
      expect(yield* heuristicBot.react(observe(called, 3))).toBeUndefined();
    }),
  );

  it.effect("gives the Dragon's Trick to the opponent holding more cards", () =>
    Effect.gen(function* () {
      let state = inPlay(["Dr 2j", "3s", "4p", "5t 6t 7t"], 0);
      for (const command of [
        { _tag: "Play", seat: 0, cards: cards("Dr") },
        { _tag: "Pass", seat: 1 },
        { _tag: "Pass", seat: 2 },
        { _tag: "Pass", seat: 3 },
      ] as const) {
        state = yield* step(state, command);
      }
      expect(yield* answerFor(heuristicBot, state, 0)).toEqual({
        _tag: "GiftDragon",
        seat: 0,
        to: 3,
      });
    }),
  );

  it.effect(
    "beats random Bots in most Matches",
    () =>
      Effect.gen(function* () {
        let wins = 0;
        const matches = 20;
        for (let seed = 0; seed < matches; seed++) {
          const winner = yield* playMatch(
            [heuristicBot, randomBot, heuristicBot, randomBot],
            `duel-${seed}`,
          );
          if (winner === 0) wins++;
        }
        expect(wins).toBeGreaterThanOrEqual(15);
      }),
    120_000,
  );
});
