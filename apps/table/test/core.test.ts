import { assert, describe, expect, it } from "@effect/vitest";
import { pendingDecisions } from "@tichu/engine";
import { defaultTableSettings, type ClientMessage } from "@tichu/protocol";
import { Effect } from "effect";
import {
  BOT_DELAY_MILLIS,
  connect,
  disconnect,
  join,
  newTable,
  nextAlarm,
  receive,
  restore,
  runDue,
  seatForToken,
  tableView,
  type TableState,
  type Transition,
} from "../src/core.ts";

const token = (seat: number) => `${seat}`.repeat(32).slice(0, 32);

const joined = (state: TableState, nickname: string, seat: number, now = 0) =>
  join(state, { nickname, seat }, token(seat), now).pipe(
    Effect.map((result) => result.transition.state),
  );

const send = (state: TableState, seat: number, message: ClientMessage, now = 0) =>
  receive(state, seat, message, now);

const rejectedBy = (effect: Effect.Effect<Transition, { reason: string }>) =>
  Effect.flip(effect).pipe(Effect.map((error) => error.reason));

/** A Table with Anna in Seat 0 and Bots elsewhere, started at time 0. */
const botTable = Effect.gen(function* () {
  let state = yield* joined(newTable("abcdefghij", defaultTableSettings, 0), "Anna", 0);
  state = (yield* connect(state, 0, 0)).state;
  for (const seat of [1, 2, 3]) {
    state = (yield* send(state, 0, { _tag: "FillSeat", seat, tier: "heuristic" })).state;
  }
  return yield* send(state, 0, { _tag: "Start" });
});

describe("lobby", () => {
  it.effect("makes the first Player the creator and de-duplicates nicknames", () =>
    Effect.gen(function* () {
      let state = newTable("abcdefghij", defaultTableSettings, 0);
      state = yield* joined(state, "Anna", 2);
      const second = yield* join(state, { nickname: "Anna", seat: 0 }, token(0), 5);
      expect(second.nickname).toBe("Anna 2");
      state = second.transition.state;
      expect(state.record.creator).toBe(2);
      expect(seatForToken(state.record, token(0))).toBe(0);
      expect(
        yield* Effect.flip(join(state, { nickname: "Bo", seat: 2 }, token(1), 6)).pipe(
          Effect.map((error) => error.reason),
        ),
      ).toBe("SeatTaken");
    }),
  );

  it.effect("lets only the creator fill Seats and start a full Table", () =>
    Effect.gen(function* () {
      let state = yield* joined(newTable("abcdefghij", defaultTableSettings, 0), "Anna", 0);
      state = yield* joined(state, "Bo", 1);
      expect(yield* rejectedBy(send(state, 1, { _tag: "FillSeat", seat: 2, tier: "random" }))).toBe(
        "NotCreator",
      );
      expect(yield* rejectedBy(send(state, 0, { _tag: "Start" }))).toBe("WrongStatus");
      state = (yield* send(state, 0, { _tag: "FillSeat", seat: 2, tier: "random" })).state;
      state = (yield* send(state, 0, { _tag: "FillSeat", seat: 3, tier: "heuristic" })).state;
      const started = yield* send(state, 0, { _tag: "Start" });
      expect(started.state.record.status).toBe("playing");
      expect(started.events.map((step) => step.logged.event._tag)).toEqual([
        "MatchStarted",
        "RoundDealt",
      ]);
      const [first, second] = started.events.map((step) => step.logged.seq);
      expect(second).toBe((first ?? 0) + 1);
      expect(tableView(started.state.record).seats[3]).toEqual({ _tag: "Bot", tier: "heuristic" });
    }),
  );
});

describe("play", () => {
  it.effect("accepts an answer only for the pending Decision's id", () =>
    Effect.gen(function* () {
      const { state } = yield* botTable;
      const mine = pendingDecisions(state.game!).find((decision) => decision.seat === 0);
      assert(mine?._tag === "GrandTichu");
      const command = { _tag: "GrandTichu", seat: 0, call: false } as const;
      expect(
        yield* rejectedBy(
          send(state, 0, { _tag: "Answer", decisionId: "grandTichu:9:0", command }),
        ),
      ).toBe("StaleDecision");
      expect(
        yield* rejectedBy(
          send(state, 0, { _tag: "Answer", decisionId: mine.id, command: { ...command, seat: 1 } }),
        ),
      ).toBe("InvalidMessage");
      const answered = yield* send(state, 0, { _tag: "Answer", decisionId: mine.id, command });
      expect(answered.events.map((step) => step.logged.event._tag)).toEqual(["GrandTichuDecided"]);
    }),
  );

  it.effect("lets Bots answer after a delay, all due Decisions at once", () =>
    Effect.gen(function* () {
      const { state } = yield* botTable;
      expect(state.record.botsDueAt).toBe(BOT_DELAY_MILLIS);
      expect(nextAlarm(state)).toBe(BOT_DELAY_MILLIS);
      const early = yield* runDue(state, BOT_DELAY_MILLIS - 1);
      expect(early.events).toHaveLength(0);
      const due = yield* runDue(state, BOT_DELAY_MILLIS);
      expect(due.events.map((step) => step.logged.event._tag)).toEqual([
        "GrandTichuDecided",
        "GrandTichuDecided",
        "GrandTichuDecided",
      ]);
      expect(pendingDecisions(due.state.game!).map((decision) => decision.seat)).toEqual([0]);
      expect(due.state.record.botsDueAt).toBeNull();
    }),
  );

  it.effect("hands a disconnected Player's pending Decision to a Bot after the grace period", () =>
    Effect.gen(function* () {
      const { state } = yield* botTable;
      const bots = yield* runDue(state, BOT_DELAY_MILLIS);
      const away = yield* disconnect(bots.state, 0, 1_000);
      expect(tableView(away.state.record).seats[0]).toMatchObject({
        connected: false,
        takeoverAt: 31_000,
      });
      expect(nextAlarm(away.state)).toBe(31_000);
      expect((yield* runDue(away.state, 30_999)).events).toHaveLength(0);
      const takenOver = yield* runDue(away.state, 31_000);
      expect(takenOver.events.map((step) => step.logged.event._tag)).toEqual([
        "GrandTichuDecided",
        "RemainingCardsDealt",
      ]);
      const back = yield* connect(takenOver.state, 0, 32_000);
      expect(tableView(back.state.record).seats[0]).toMatchObject({
        connected: true,
        takeoverAt: null,
      });
    }),
  );

  it.effect(
    "plays a whole Bot Match through alarms, exports it and offers a rematch",
    () =>
      Effect.gen(function* () {
        let { state } = yield* botTable;
        state = (yield* disconnect(state, 0, 0)).state;
        state = {
          ...state,
          record: {
            ...state.record,
            settings: { ...state.record.settings, match: { targetScore: 200 } },
          },
        };
        const exports: Array<number> = [];
        let now = 0;
        for (let wake = 0; wake < 20_000 && state.record.status === "playing"; wake++) {
          now = Math.max(now, nextAlarm(state) ?? now);
          const result = yield* runDue(state, now);
          exports.push(...result.exports);
          state = result.state;
        }
        expect(state.record.status).toBe("finished");
        expect(exports).toEqual([1]);
        state = (yield* connect(state, 0, now)).state;
        const rematch = yield* send(state, 0, { _tag: "Rematch" }, now);
        expect(rematch.state.record.match).toBe(2);
        expect(rematch.state.game?.winningTeam).toBeNull();
      }),
    60_000,
  );

  it.effect("restores the same state from the persisted row and the Match's events", () =>
    Effect.gen(function* () {
      const started = yield* botTable;
      const due = yield* runDue(started.state, BOT_DELAY_MILLIS);
      const events = [...started.events, ...due.events].map((step) => step.logged.event);
      expect(restore(due.state.record, events)).toEqual(due.state);
    }),
  );
});

describe("Seats", () => {
  it.effect("lets a Player release a disconnected Seat and passes on the creator role", () =>
    Effect.gen(function* () {
      let state = yield* joined(newTable("abcdefghij", defaultTableSettings, 0), "Anna", 0);
      state = yield* joined(state, "Bo", 1, 1);
      state = yield* joined(state, "Cy", 2, 2);
      state = (yield* connect(state, 1, 3)).state;
      state = (yield* connect(state, 2, 3)).state;
      expect(yield* rejectedBy(send(state, 2, { _tag: "ReleaseSeat", seat: 1 }))).toBe(
        "InvalidSeat",
      );
      const released = yield* send(state, 2, { _tag: "ReleaseSeat", seat: 0 });
      expect(released.state.record.seats[0]).toBeNull();
      expect(released.state.record.creator).toBe(1);
      const handed = yield* send(released.state, 1, { _tag: "FillSeat", seat: 0, tier: "random" });
      expect(handed.state.record.seats[0]).toEqual({ _tag: "Bot", tier: "random" });
    }),
  );

  it.effect("exports an unfinished Match when the creator closes the Table", () =>
    Effect.gen(function* () {
      const { state } = yield* botTable;
      const closed = yield* send(state, 0, { _tag: "Close" });
      expect(closed.state.record.status).toBe("closed");
      expect(closed.exports).toEqual([1]);
      expect(closed.closeSockets).toBe(true);
    }),
  );
});
