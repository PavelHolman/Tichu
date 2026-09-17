import { Observation, Seat, StandardCommand, StandardEvent, StandardSettings } from "@tichu/engine";
import { Schema } from "effect";

export const BotTier = Schema.Literals(["random", "heuristic"]);
export type BotTier = typeof BotTier.Type;

export const Nickname = Schema.String.check(
  Schema.isTrimmed(),
  Schema.isMinLength(1),
  Schema.isMaxLength(24),
);

/** A 128-bit random Seat token, hex encoded: the sole credential for a Seat. */
export const SeatToken = Schema.String.check(Schema.isPattern(/^[0-9a-f]{32}$/));

export const TableId = Schema.String.check(Schema.isPattern(/^[0-9A-Za-z]{10}$/));

export const TableSettings = Schema.Struct({
  variant: Schema.Literal("standard"),
  match: StandardSettings,
  /** Seconds a disconnected Seat with a pending Decision waits before a Bot answers. */
  takeoverGraceSeconds: Schema.Int.check(Schema.isBetween({ minimum: 5, maximum: 600 })),
});
export type TableSettings = typeof TableSettings.Type;

export const defaultTableSettings: TableSettings = {
  variant: "standard",
  match: { targetScore: 1000 },
  takeoverGraceSeconds: 30,
};

export const Occupant = Schema.Union([
  Schema.TaggedStruct("Player", {
    nickname: Nickname,
    connected: Schema.Boolean,
    /** When a Bot starts answering for this disconnected Seat, in epoch milliseconds. */
    takeoverAt: Schema.NullOr(Schema.Number),
  }),
  Schema.TaggedStruct("Bot", { tier: BotTier }),
]);
export type Occupant = typeof Occupant.Type;

export const TableStatus = Schema.Literals(["lobby", "playing", "finished", "closed"]);
export type TableStatus = typeof TableStatus.Type;

/** The public state of a Table, as shown in the lobby and around the play area. */
export const TableView = Schema.Struct({
  id: TableId,
  settings: TableSettings,
  status: TableStatus,
  seats: Schema.Array(Schema.NullOr(Occupant)),
  creator: Schema.NullOr(Seat),
});
export type TableView = typeof TableView.Type;

// HTTP

export const CreateTableRequest = Schema.Struct({ settings: TableSettings });
export const CreateTableResponse = Schema.Struct({ tableId: TableId });

export const JoinRequest = Schema.Struct({ nickname: Nickname, seat: Seat });
export const JoinResponse = Schema.Struct({ seat: Seat, token: SeatToken, nickname: Nickname });

export const HttpError = Schema.Struct({ error: Schema.String, message: Schema.String });
export type HttpError = typeof HttpError.Type;

// WebSocket, client to server

export const ClientMessage = Schema.Union([
  /** Answers the pending Decision named by `decisionId`. */
  Schema.TaggedStruct("Answer", { decisionId: Schema.String, command: StandardCommand }),
  /** Volunteers a Reaction; `seenSeq` is the last sequence number the client had. */
  Schema.TaggedStruct("React", { seenSeq: Schema.Int, command: StandardCommand }),
  Schema.TaggedStruct("FillSeat", { seat: Seat, tier: BotTier }),
  Schema.TaggedStruct("EmptySeat", { seat: Seat }),
  Schema.TaggedStruct("ReleaseSeat", { seat: Seat }),
  Schema.TaggedStruct("HandToBot", { seat: Seat }),
  Schema.TaggedStruct("UpdateSettings", { settings: TableSettings }),
  Schema.TaggedStruct("Start", {}),
  Schema.TaggedStruct("Rematch", {}),
  Schema.TaggedStruct("Close", {}),
]);
export type ClientMessage = typeof ClientMessage.Type;

// WebSocket, server to client

export const RejectionReason = Schema.Literals([
  "RuleViolation",
  "StaleDecision",
  "NotSeated",
  "NotCreator",
  "WrongStatus",
  "InvalidMessage",
  "InvalidSeat",
]);
export type RejectionReason = typeof RejectionReason.Type;

export const ServerMessage = Schema.Union([
  /** Sent first on every connection. */
  Schema.TaggedStruct("Snapshot", {
    seq: Schema.Int,
    table: TableView,
    you: Seat,
    observation: Schema.NullOr(Observation),
  }),
  /** One per event (redacted for this Seat) or Table change, with the resulting Observation. */
  Schema.TaggedStruct("Update", {
    seq: Schema.Int,
    event: Schema.NullOr(StandardEvent),
    table: TableView,
    observation: Schema.NullOr(Observation),
  }),
  Schema.TaggedStruct("Rejected", {
    reason: RejectionReason,
    message: Schema.String,
  }),
]);
export type ServerMessage = typeof ServerMessage.Type;

export const PING = "ping";
export const PONG = "pong";
export const PING_INTERVAL_MILLIS = 20_000;

export const decodeClientMessage = Schema.decodeUnknownEffect(Schema.fromJsonString(ClientMessage));
export const encodeClientMessage = Schema.encodeEffect(Schema.fromJsonString(ClientMessage));
export const decodeServerMessage = Schema.decodeUnknownEffect(Schema.fromJsonString(ServerMessage));
export const encodeServerMessage = Schema.encodeEffect(Schema.fromJsonString(ServerMessage));

/** Paths on the Table Worker. The WebSocket takes the Seat token as the `token` query parameter. */
export const paths = {
  tables: "/api/tables",
  table: (id: string) => `/api/tables/${id}`,
  seats: (id: string) => `/api/tables/${id}/seats`,
  socket: (id: string) => `/api/tables/${id}/socket`,
} as const;
