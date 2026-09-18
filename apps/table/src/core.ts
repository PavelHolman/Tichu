/**
 * The Table: lobby, Seats, connections, Bots and takeovers around the rules engine. Pure: every
 * operation takes the current state and a time, and returns the next state plus what the Durable
 * Object must persist and broadcast. The Durable Object adapter owns storage, sockets and alarms.
 */
import { bots, heuristicBot, randomBot, type BotTier } from "@tichu/bots";
import {
  game as engine,
  seatsFor,
  type Decision,
  type GameCommand,
  type GameEvent,
  type GameState,
  type Seat,
} from "@tichu/engine";
import type {
  ClientMessage,
  Occupant,
  ServerMessage,
  TableSettings,
  TableStatus,
  TableView,
} from "@tichu/protocol";
import { Cause, Effect, Random, Schema } from "effect";
import { Temporal } from "temporal-polyfill";

export const BOT_DELAY_MILLIS = 700;
export const LIVENESS_TIMEOUT_MILLIS = 45_000;
export const RETENTION_MILLIS = Temporal.Duration.from({ hours: 24 * 7 }).total("milliseconds");

export class TableRejection extends Schema.TaggedError<TableRejection>()("TableRejection", {
  reason: Schema.Literals([
    "RuleViolation",
    "StaleDecision",
    "NotSeated",
    "NotCreator",
    "WrongStatus",
    "InvalidMessage",
    "InvalidSeat",
    "SeatTaken",
  ]),
  message: Schema.String,
}) {}

const reject = (reason: TableRejection["reason"], message: string) =>
  new TableRejection({ reason, message });

export interface PlayerSeat {
  readonly _tag: "Player";
  readonly nickname: string;
  readonly token: string;
  readonly joinedAt: number;
  readonly connected: boolean;
  /** When the Seat last lost its connection; null while connected. */
  readonly disconnectedAt: number | null;
}

export interface BotSeat {
  readonly _tag: "Bot";
  readonly tier: BotTier;
}

export type SeatRecord = PlayerSeat | BotSeat | null;

/** The persisted Table row. */
export interface TableRecord {
  readonly id: string;
  readonly settings: TableSettings;
  readonly status: TableStatus;
  readonly seats: ReadonlyArray<SeatRecord>;
  /** When each empty Seat was vacated during a Match, so a Bot can stand in after the grace period. */
  readonly vacatedAt: ReadonlyArray<number | null>;
  readonly creator: Seat | null;
  /** The current Match, counting from 1; 0 before the first start. */
  readonly match: number;
  /** The Table-wide sequence number of the last message. */
  readonly seq: number;
  readonly lastActivityAt: number;
  /** When pending Bot Decisions are due. */
  readonly botsDueAt: number | null;
  readonly exportedMatches: ReadonlyArray<number>;
}

export interface LoggedEvent {
  readonly seq: number;
  readonly match: number;
  readonly at: number;
  readonly event: GameEvent;
}

export interface TableState {
  readonly record: TableRecord;
  /** The engine state of the current Match, folded from its events. */
  readonly game: GameState | null;
}

/** What a transition asks the adapter to do. */
export interface Transition {
  readonly state: TableState;
  /** Engine events to append and broadcast, each with the Match state right after it. */
  readonly events: ReadonlyArray<{ readonly logged: LoggedEvent; readonly game: GameState }>;
  /** Whether a Table-only change must be broadcast after the events. */
  readonly tableChanged: boolean;
  /** Matches whose event log is complete and should be exported. */
  readonly exports: ReadonlyArray<number>;
  readonly closeSockets: boolean;
}

export const newTable = (id: string, settings: TableSettings, now: number): TableState => ({
  record: {
    id,
    settings,
    status: "lobby",
    seats: Array.from({ length: seatsFor(settings.game) }, () => null),
    vacatedAt: Array.from({ length: seatsFor(settings.game) }, () => null),
    creator: null,
    match: 0,
    seq: 0,
    lastActivityAt: now,
    botsDueAt: null,
    exportedMatches: [],
  },
  game: null,
});

/** Rebuilds live state from the persisted row and the current Match's events. */
export const restore = (record: TableRecord, events: ReadonlyArray<GameEvent>): TableState => ({
  record,
  game: record.match === 0 || events.length === 0 ? null : engine.replay(events),
});

const replaceAt = <A>(items: ReadonlyArray<A>, index: number, value: A): Array<A> =>
  items.map((item, i) => (i === index ? value : item));

class Builder {
  events: Array<{ logged: LoggedEvent; game: GameState }> = [];
  tableChanged = false;
  exports: Array<number> = [];
  closeSockets = false;
  constructor(public state: TableState) {}
  get record() {
    return this.state.record;
  }
  setRecord(record: TableRecord, changed = true) {
    this.state = { ...this.state, record };
    if (changed) this.tableChanged = true;
  }
  append(events: ReadonlyArray<GameEvent>, now: number) {
    let { game, record } = this.state;
    let seq = record.seq;
    for (const event of events) {
      seq++;
      game = engine.evolve(game, event);
      this.events.push({ logged: { seq, match: record.match, at: now, event }, game });
      if (event._tag === "MatchEnded") {
        record = { ...record, status: "finished" };
        this.exports.push(record.match);
        this.tableChanged = true;
      }
    }
    this.state = { record: { ...record, seq }, game };
  }
  done(): Transition {
    const record = this.tableChanged
      ? { ...this.state.record, seq: this.state.record.seq + 1 }
      : this.state.record;
    return {
      state: { ...this.state, record },
      events: this.events,
      tableChanged: this.tableChanged,
      exports: this.exports,
      closeSockets: this.closeSockets,
    };
  }
}

export const tableView = (record: TableRecord): TableView => ({
  id: record.id,
  settings: record.settings,
  status: record.status,
  creator: record.creator,
  seats: record.seats.map((seat): Occupant | null => {
    if (seat === null) return null;
    if (seat._tag === "Bot") return { _tag: "Bot", tier: seat.tier };
    return {
      _tag: "Player",
      nickname: seat.nickname,
      connected: seat.connected,
      takeoverAt:
        seat.disconnectedAt === null
          ? null
          : seat.disconnectedAt + record.settings.takeoverGraceSeconds * 1000,
    };
  }),
});

const uniqueNickname = (record: TableRecord, wanted: string): string => {
  const taken = new Set(
    record.seats.flatMap((seat) => (seat?._tag === "Player" ? [seat.nickname] : [])),
  );
  if (!taken.has(wanted)) return wanted;
  for (let suffix = 2; ; suffix++) {
    const candidate = `${wanted.slice(0, 21)} ${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
};

export const join = (
  state: TableState,
  request: { readonly nickname: string; readonly seat: Seat },
  token: string,
  now: number,
) =>
  Effect.gen(function* () {
    const { record } = state;
    if (record.status === "closed" || record.status === "finished") {
      return yield* reject("WrongStatus", "This Table is not taking Players");
    }
    if (
      !Number.isInteger(request.seat) ||
      request.seat < 0 ||
      request.seat >= record.seats.length
    ) {
      return yield* reject("InvalidSeat", "No such Seat");
    }
    if (record.seats[request.seat] !== null) {
      return yield* reject("SeatTaken", "That Seat is taken");
    }
    const nickname = uniqueNickname(record, request.nickname);
    const out = new Builder(state);
    out.setRecord({
      ...record,
      seats: replaceAt(record.seats, request.seat, {
        _tag: "Player",
        nickname,
        token,
        joinedAt: now,
        connected: false,
        disconnectedAt: now,
      }),
      vacatedAt: replaceAt(record.vacatedAt, request.seat, null),
      creator: record.creator ?? request.seat,
      lastActivityAt: now,
    });
    return { transition: yield* settle(out, now), nickname };
  });

export const seatForToken = (record: TableRecord, token: string): Seat | undefined => {
  const seat = record.seats.findIndex((held) => held?._tag === "Player" && held.token === token);
  return seat === -1 ? undefined : seat;
};

const updatePlayer = (
  record: TableRecord,
  seat: Seat,
  update: (player: PlayerSeat) => PlayerSeat,
): TableRecord => {
  const held = record.seats[seat];
  return held?._tag === "Player"
    ? { ...record, seats: replaceAt(record.seats, seat, update(held)) }
    : record;
};

export const connect = (state: TableState, seat: Seat, now: number) =>
  Effect.gen(function* () {
    const out = new Builder(state);
    const held = state.record.seats[seat];
    const wasConnected = held?._tag === "Player" && held.connected;
    out.setRecord(
      {
        ...updatePlayer(state.record, seat, (player) => ({
          ...player,
          connected: true,
          disconnectedAt: null,
        })),
        lastActivityAt: now,
      },
      !wasConnected,
    );
    return yield* settle(out, now);
  });

export const disconnect = (state: TableState, seat: Seat, now: number) =>
  Effect.gen(function* () {
    const out = new Builder(state);
    const held = state.record.seats[seat];
    // A Seat already away keeps its first disconnection time, so the takeover grace never restarts.
    if (held?._tag !== "Player" || !held.connected) return yield* settle(out, now);
    out.setRecord({
      ...updatePlayer(state.record, seat, (player) => ({
        ...player,
        connected: false,
        disconnectedAt: now,
      })),
      lastActivityAt: now,
    });
    return yield* settle(out, now);
  });

const requireCreator = (record: TableRecord, seat: Seat) =>
  record.creator === seat
    ? Effect.void
    : Effect.fail(reject("NotCreator", "Only the Table's creator may do that"));

const requireStatus = (record: TableRecord, ...statuses: ReadonlyArray<TableStatus>) =>
  statuses.includes(record.status)
    ? Effect.void
    : Effect.fail(reject("WrongStatus", `Not possible while the Table is ${record.status}`));

const requireSeatIndex = (record: TableRecord, seat: Seat) =>
  Number.isInteger(seat) && seat >= 0 && seat < record.seats.length
    ? Effect.void
    : Effect.fail(reject("InvalidSeat", "No such Seat"));

/** The longest-connected Player other than `excluding`, who inherits the creator role. */
const successor = (record: TableRecord, excluding: Seat): Seat | null => {
  const candidates = record.seats
    .map((seat, index) => ({ seat, index }))
    .filter(
      (entry): entry is { seat: PlayerSeat; index: number } =>
        entry.index !== excluding && entry.seat?._tag === "Player" && entry.seat.connected,
    )
    .toSorted((a, b) => a.seat.joinedAt - b.seat.joinedAt);
  return candidates[0]?.index ?? null;
};

const applyCommand = (out: Builder, command: GameCommand, now: number) =>
  Effect.gen(function* () {
    const game = out.state.game;
    if (game === null || out.record.status !== "playing") {
      return yield* reject("WrongStatus", "No Match is in progress");
    }
    const events = yield* engine
      .decide(game, command)
      .pipe(Effect.mapError((violation) => reject("RuleViolation", violation.message)));
    out.append(events, now);
  });

const startMatch = (out: Builder, now: number) =>
  Effect.gen(function* () {
    const events = yield* engine.start(out.record.settings.game);
    out.setRecord({ ...out.record, status: "playing", match: out.record.match + 1 });
    out.state = { ...out.state, game: null };
    out.append(events, now);
  });

export const receive = (state: TableState, seat: Seat, message: ClientMessage, now: number) =>
  Effect.gen(function* () {
    const out = new Builder(state);
    const record = state.record;
    out.setRecord({ ...record, lastActivityAt: now }, false);
    switch (message._tag) {
      case "Answer": {
        const pending = state.game === null ? [] : engine.pendingDecisions(state.game);
        const decision = pending.find((candidate) => candidate.seat === seat);
        if (decision === undefined || decision.id !== message.decisionId) {
          return yield* reject("StaleDecision", "That Decision is no longer pending");
        }
        if (message.command.seat !== seat || !answers(decision, message.command)) {
          return yield* reject("InvalidMessage", "The answer does not match the Decision");
        }
        yield* applyCommand(out, message.command, now);
        break;
      }
      case "React": {
        const command = message.command;
        if (command.seat !== seat || (command._tag !== "CallTichu" && command._tag !== "Play")) {
          return yield* reject("InvalidMessage", "Only a Call or a Bomb may be volunteered");
        }
        yield* applyCommand(out, command, now);
        break;
      }
      case "FillSeat": {
        yield* requireCreator(record, seat);
        yield* requireStatus(record, "lobby");
        yield* requireSeatIndex(record, message.seat);
        if (record.seats[message.seat] !== null) {
          return yield* reject("SeatTaken", "That Seat is taken");
        }
        out.setRecord({
          ...out.record,
          seats: replaceAt(record.seats, message.seat, { _tag: "Bot", tier: message.tier }),
        });
        break;
      }
      case "EmptySeat": {
        yield* requireCreator(record, seat);
        yield* requireStatus(record, "lobby");
        yield* requireSeatIndex(record, message.seat);
        if (record.seats[message.seat]?._tag !== "Bot") {
          return yield* reject("InvalidSeat", "Only a Bot's Seat can be emptied");
        }
        out.setRecord({ ...out.record, seats: replaceAt(record.seats, message.seat, null) });
        break;
      }
      case "ReleaseSeat":
      case "HandToBot": {
        yield* requireStatus(record, "lobby", "playing", "finished");
        yield* requireSeatIndex(record, message.seat);
        const target = record.seats[message.seat];
        if (target?._tag !== "Player" || target.connected) {
          return yield* reject("InvalidSeat", "Only a disconnected Player's Seat can be released");
        }
        const replacement: SeatRecord =
          message._tag === "HandToBot" ? { _tag: "Bot", tier: "heuristic" } : null;
        const released = {
          ...out.record,
          seats: replaceAt(record.seats, message.seat, replacement),
          vacatedAt: replaceAt(record.vacatedAt, message.seat, replacement === null ? now : null),
        };
        out.setRecord({
          ...released,
          creator:
            record.creator === message.seat ? successor(released, message.seat) : record.creator,
        });
        break;
      }
      case "UpdateSettings": {
        yield* requireCreator(record, seat);
        yield* requireStatus(record, "lobby");
        const seats = seatsFor(message.settings.game);
        if (
          record.seats.slice(seats).some((held) => held !== null) ||
          (record.creator ?? 0) >= seats
        ) {
          return yield* reject("InvalidSeat", "Empty the Seats that would be removed first");
        }
        const resize = <A>(items: ReadonlyArray<A>, fill: A) =>
          Array.from({ length: seats }, (_, index) => items[index] ?? fill);
        out.setRecord({
          ...out.record,
          settings: message.settings,
          seats: resize<SeatRecord>(record.seats, null),
          vacatedAt: resize<number | null>(record.vacatedAt, null),
        });
        break;
      }
      case "Start":
      case "Rematch": {
        yield* requireCreator(record, seat);
        yield* requireStatus(record, message._tag === "Start" ? "lobby" : "finished");
        if (record.seats.some((held) => held === null)) {
          return yield* reject("WrongStatus", "Every Seat must be filled first");
        }
        yield* startMatch(out, now);
        break;
      }
      case "Close": {
        yield* requireCreator(record, seat);
        const unfinished =
          record.status === "playing" && !record.exportedMatches.includes(record.match);
        out.setRecord({ ...out.record, status: "closed", botsDueAt: null });
        if (unfinished) out.exports.push(record.match);
        out.closeSockets = true;
        break;
      }
    }
    return yield* settle(out, now);
  });

/** Whether a command answers `decision` (rather than being some other command from that Seat). */
const answers = (decision: Decision, command: GameCommand): boolean => {
  switch (decision._tag) {
    case "GrandTichu":
      return command._tag === "GrandTichu";
    case "Exchange":
      return command._tag === "Exchange";
    case "Play":
      return command._tag === "Play" || command._tag === "Pass";
    case "DragonGift":
      return command._tag === "GiftDragon";
    case "ForcedGive":
      return command._tag === "GiveBest";
    case "ReturnCards":
      return command._tag === "ReturnCards";
  }
};

/** Whether nobody can answer for `seat` right now: a Player who is away, or an empty Seat. */
const awayAt = (record: TableRecord, seat: Seat): number | null => {
  const held = record.seats[seat];
  if (held === null || held === undefined) return record.vacatedAt[seat] ?? null;
  if (held._tag === "Player") return held.connected ? null : held.disconnectedAt;
  return null;
};

const takeoverDueAt = (record: TableRecord, seat: Seat): number | null => {
  const away = awayAt(record, seat);
  return away === null ? null : away + record.settings.takeoverGraceSeconds * 1000;
};

const botFor = (record: TableRecord, seat: Seat) => {
  const held = record.seats[seat];
  return held?._tag === "Bot" ? bots[held.tier] : heuristicBot;
};

/**
 * Asks a Bot for an answer, falling back to a random legal option if it fails or answers
 * illegally. Seeded by the Table id and sequence number, so a replay makes the same choice.
 */
const botAnswer = (state: TableState, seat: Seat, decision: Decision) =>
  Effect.gen(function* () {
    const game = state.game as GameState;
    const seed = `${state.record.id}:${state.record.seq}:${seat}`;
    const observation = engine.observe(game, seat);
    const bot = botFor(state.record, seat);
    const chosen = yield* bot.decide(observation, decision).pipe(
      Effect.flatMap((command) => engine.decide(game, command).pipe(Effect.as(command))),
      Effect.catchCause((cause) =>
        Effect.logWarning(`Bot answer rejected, answering randomly: ${Cause.pretty(cause)}`).pipe(
          Effect.andThen(randomBot.decide(observation, decision)),
        ),
      ),
      Random.withSeed(seed),
    );
    return chosen;
  });

/** Lets Bot Seats volunteer Reactions after new events. Never acts for absent Players. */
const botReactions = (out: Builder, now: number) =>
  Effect.gen(function* () {
    for (let round = 0; round < 8; round++) {
      const game = out.state.game;
      if (game === null || out.record.status !== "playing") return;
      let reacted = false;
      for (let seat = 0; seat < out.record.seats.length; seat++) {
        const held = out.record.seats[seat];
        if (held?._tag !== "Bot") continue;
        const seed = `${out.record.id}:${out.record.seq}:${seat}:react`;
        const command = yield* bots[held.tier]
          .react(engine.observe(game, seat))
          .pipe(Random.withSeed(seed));
        if (command === undefined) continue;
        const events = yield* Effect.result(engine.decide(game, command));
        if (events._tag === "Success") {
          out.append(events.success, now);
          reacted = true;
          break;
        }
      }
      if (!reacted) return;
    }
  });

/** Whether a Bot drives `seat` right now: a Bot's Seat, or an away Seat past its grace period. */
const drivenByBot = (record: TableRecord, seat: Seat, now: number): boolean => {
  if (record.seats[seat]?._tag === "Bot") return true;
  const takeover = takeoverDueAt(record, seat);
  return takeover !== null && takeover <= now;
};

/**
 * Answers the Bot-driven Decisions that were pending when the Bots came due. Decisions that arise
 * meanwhile wait for the next Bot delay, so Bots never play instantly.
 */
export const runDue = (state: TableState, now: number) =>
  Effect.gen(function* () {
    const out = new Builder(state);
    const game = state.game;
    const botsDue = state.record.botsDueAt !== null && state.record.botsDueAt <= now;
    if (game !== null && state.record.status === "playing") {
      const due = new Set(
        engine
          .pendingDecisions(game)
          .filter((decision) => {
            if (state.record.seats[decision.seat]?._tag === "Bot") return botsDue;
            const takeover = takeoverDueAt(state.record, decision.seat);
            return (
              takeover !== null && takeover <= now && (botsDue || state.record.botsDueAt === null)
            );
          })
          .map((decision) => decision.id),
      );
      for (let guard = 0; guard < 16 && due.size > 0; guard++) {
        const current = out.state.game;
        if (current === null || out.record.status !== "playing") break;
        const decision = engine.pendingDecisions(current).find((pending) => due.has(pending.id));
        if (decision === undefined) break;
        due.delete(decision.id);
        const command = yield* botAnswer(out.state, decision.seat, decision);
        out.append(yield* engine.decide(current, command).pipe(Effect.orDie), now);
      }
    }
    if (botsDue) out.setRecord({ ...out.record, botsDueAt: null }, false);
    return yield* settle(out, now);
  });

const scheduleBots = (out: Builder, now: number) =>
  Effect.sync(() => {
    const game = out.state.game;
    const botPending =
      game !== null &&
      out.record.status === "playing" &&
      engine.pendingDecisions(game).some((decision) => drivenByBot(out.record, decision.seat, now));
    if (!botPending) {
      if (out.record.botsDueAt !== null) out.setRecord({ ...out.record, botsDueAt: null }, false);
    } else if (out.record.botsDueAt === null) {
      out.setRecord({ ...out.record, botsDueAt: now + BOT_DELAY_MILLIS }, false);
    }
  });

/** Common tail of every transition: Bot Reactions and Bot scheduling. */
const settle = (out: Builder, now: number) =>
  Effect.gen(function* () {
    if (out.events.length > 0) yield* botReactions(out, now);
    yield* scheduleBots(out, now);
    return out.done();
  });

/** When the adapter should next wake the Table, or null for never. */
export const nextAlarm = (state: TableState): number | null => {
  const { record, game } = state;
  if (record.status === "closed") return record.lastActivityAt + RETENTION_MILLIS;
  const times: Array<number> = [record.lastActivityAt + RETENTION_MILLIS];
  if (record.botsDueAt !== null) times.push(record.botsDueAt);
  if (game !== null && record.status === "playing") {
    for (const decision of engine.pendingDecisions(game)) {
      const takeover = takeoverDueAt(record, decision.seat);
      // A takeover due before the Bots' next turn is answered together with them.
      const covered =
        record.botsDueAt !== null && takeover !== null && takeover <= record.botsDueAt;
      if (takeover !== null && !covered && record.seats[decision.seat]?._tag !== "Bot") {
        times.push(takeover);
      }
    }
  }
  return Math.min(...times);
};

/** The message a connected Seat receives for one event, or for a Table-only change. */
export const updateFor = (
  record: TableRecord,
  seat: Seat,
  event: LoggedEvent | null,
  game: GameState | null,
): ServerMessage => ({
  _tag: "Update",
  seq: event?.seq ?? record.seq,
  event: event === null ? null : engine.redact(event.event, seat),
  table: tableView(record),
  observation: game === null ? null : engine.observe(game, seat),
});

export const snapshotFor = (state: TableState, seat: Seat): ServerMessage => ({
  _tag: "Snapshot",
  seq: state.record.seq,
  table: tableView(state.record),
  you: seat,
  observation: state.game === null ? null : engine.observe(state.game, seat),
});

export const rejectionMessage = (rejection: TableRejection): ServerMessage => ({
  _tag: "Rejected",
  reason: rejection.reason === "SeatTaken" ? "InvalidSeat" : rejection.reason,
  message: rejection.message,
});

/** The event log of a Match as JSONL, the training corpus format. */
export const toJsonl = (tableId: string, events: ReadonlyArray<LoggedEvent>): string =>
  events.map((entry) => JSON.stringify({ table: tableId, ...entry })).join("\n") + "\n";
