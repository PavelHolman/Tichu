import type { StandardEvent } from "@tichu/engine";
import {
  CreateTableRequest,
  JoinRequest,
  PING,
  PONG,
  decodeClientMessage,
  encodeServerMessage,
  type ServerMessage,
  type TableSettings,
} from "@tichu/protocol";
import { DurableObject } from "cloudflare:workers";
import { Clock, Effect, Schema } from "effect";
import {
  LIVENESS_TIMEOUT_MILLIS,
  RETENTION_MILLIS,
  TableRejection,
  connect,
  disconnect,
  join,
  newTable,
  nextAlarm,
  receive,
  rejectionMessage,
  restore,
  runDue,
  seatForToken,
  snapshotFor,
  tableView,
  toJsonl,
  updateFor,
  type LoggedEvent,
  type TableRecord,
  type TableState,
  type Transition,
} from "./core.ts";

interface Attachment {
  readonly seat: number;
  readonly connectedAt: number;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

const httpError = (status: number, error: string, message: string) =>
  json({ error, message }, status);

const rejectionStatus = (rejection: TableRejection): number =>
  rejection.reason === "SeatTaken" ? 409 : rejection.reason === "InvalidSeat" ? 400 : 409;

/** Reads and validates a JSON body; a malformed body is a failure, never an exception. */
const readBody = <A, I>(request: Request, schema: Schema.Codec<A, I>) =>
  Effect.runPromise(
    Effect.result(
      Effect.tryPromise(() => request.json()).pipe(
        Effect.mapError(() => "The body is not JSON"),
        Effect.flatMap((body) =>
          Schema.decodeUnknownEffect(schema)(body).pipe(Effect.mapError((error) => error.message)),
        ),
      ),
    ),
  );

const randomToken = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

/**
 * One Table: the authoritative state, its event log in SQLite, its WebSockets and its Alarm.
 * All rules live in `core.ts`; this class only persists, broadcasts and schedules.
 */
export class Table extends DurableObject<Env> {
  private cached: TableState | null = null;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS meta (id INTEGER PRIMARY KEY CHECK (id = 1), record TEXT NOT NULL)",
    );
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY, match INTEGER NOT NULL, at INTEGER NOT NULL, event TEXT NOT NULL)",
    );
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  private load(): TableState | null {
    if (this.cached !== null) return this.cached;
    const rows = this.ctx.storage.sql.exec<{ record: string }>("SELECT record FROM meta").toArray();
    const row = rows[0];
    if (row === undefined) return null;
    const record = JSON.parse(row.record) as TableRecord;
    const events = this.matchEvents(record.match).map((entry) => entry.event);
    this.cached = restore(record, events);
    return this.cached;
  }

  private matchEvents(match: number): Array<LoggedEvent> {
    return this.ctx.storage.sql
      .exec<{ seq: number; match: number; at: number; event: string }>(
        "SELECT seq, match, at, event FROM events WHERE match = ? ORDER BY seq",
        match,
      )
      .toArray()
      .map((row) => ({
        seq: row.seq,
        match: row.match,
        at: row.at,
        event: JSON.parse(row.event) as StandardEvent,
      }));
  }

  private saveRecord(record: TableRecord) {
    this.ctx.storage.sql.exec(
      "INSERT INTO meta (id, record) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET record = excluded.record",
      JSON.stringify(record),
    );
  }

  /** Persists a transition, broadcasts it, exports finished Matches and reschedules the Alarm. */
  private async commit(transition: Transition): Promise<void> {
    for (const { logged } of transition.events) {
      this.ctx.storage.sql.exec(
        "INSERT INTO events (seq, match, at, event) VALUES (?, ?, ?, ?)",
        logged.seq,
        logged.match,
        logged.at,
        JSON.stringify(logged.event),
      );
    }
    this.saveRecord(transition.state.record);
    this.cached = transition.state;

    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as Attachment | null;
      if (attachment === null) continue;
      for (const step of transition.events) {
        this.send(
          socket,
          updateFor(transition.state.record, attachment.seat, step.logged, step.game),
        );
      }
      if (transition.tableChanged) {
        this.send(
          socket,
          updateFor(transition.state.record, attachment.seat, null, transition.state.game),
        );
      }
      if (transition.closeSockets) socket.close(1000, "Table closed");
    }

    for (const match of transition.exports) await this.exportMatch(match, false);
    await this.schedule();
  }

  private send(socket: WebSocket, message: ServerMessage) {
    const text = Effect.runSync(
      encodeServerMessage(message).pipe(
        Effect.catch((error) =>
          Effect.logError(`Could not encode a server message: ${error.message}`).pipe(
            Effect.as(undefined),
          ),
        ),
      ),
    );
    if (text !== undefined) socket.send(text);
  }

  private async exportMatch(match: number, partial: boolean): Promise<void> {
    const state = this.load();
    if (state === null || state.record.exportedMatches.includes(match)) return;
    const events = this.matchEvents(match);
    if (events.length === 0) return;
    const key = `matches/${state.record.id}/${match}${partial ? ".partial" : ""}.jsonl`;
    const stored = await Effect.runPromise(
      Effect.tryPromise(() =>
        this.env.CORPUS.put(key, toJsonl(state.record.id, events), {
          httpMetadata: { contentType: "application/x-ndjson" },
        }),
      ).pipe(
        Effect.as(true),
        Effect.catch((error) =>
          Effect.logError(`Export of ${key} failed: ${String(error.cause)}`).pipe(Effect.as(false)),
        ),
      ),
    );
    if (!stored) return;
    const latest = this.load();
    if (latest === null) return;
    const record = { ...latest.record, exportedMatches: [...latest.record.exportedMatches, match] };
    this.saveRecord(record);
    this.cached = { ...latest, record };
  }

  private async schedule(): Promise<void> {
    const state = this.load();
    if (state === null) return;
    const times: Array<number> = [];
    const next = nextAlarm(state);
    if (next !== null) times.push(next);
    const sockets = this.ctx.getWebSockets();
    if (sockets.length > 0 && state.record.status === "playing") {
      times.push((await this.now()) + LIVENESS_TIMEOUT_MILLIS);
    }
    if (times.length === 0) return this.ctx.storage.deleteAlarm();
    await this.ctx.storage.setAlarm(Math.min(...times));
  }

  private now(): Promise<number> {
    return Effect.runPromise(Clock.currentTimeMillis);
  }

  /** Runs a core transition, turning a rejection into a value. */
  private run<A>(effect: Effect.Effect<A, TableRejection>) {
    return Effect.runPromise(Effect.result(effect));
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const [, , , id, action] = url.pathname.split("/");
    const now = await this.now();

    if (request.method === "POST" && action === "init") {
      if (this.load() !== null) return httpError(409, "Exists", "Table already exists");
      const body = await readBody(request, CreateTableRequest);
      if (body._tag === "Failure") return httpError(400, "InvalidRequest", body.failure);
      const settings: TableSettings = body.success.settings;
      const state = newTable(id ?? "", settings, now);
      this.saveRecord(state.record);
      this.cached = state;
      await this.schedule();
      return json({ tableId: state.record.id }, 201);
    }

    const state = this.load();
    if (state === null || (state.record.status === "closed" && action !== undefined)) {
      return httpError(404, "NotFound", "No such Table");
    }

    if (request.method === "GET" && action === undefined) return json(tableView(state.record));

    if (request.method === "POST" && action === "seats") {
      const body = await readBody(request, JoinRequest);
      if (body._tag === "Failure") return httpError(400, "InvalidRequest", body.failure);
      const token = randomToken();
      const result = await this.run(join(state, body.success, token, now));
      if (result._tag === "Failure") {
        return httpError(
          rejectionStatus(result.failure),
          result.failure.reason,
          result.failure.message,
        );
      }
      await this.commit(result.success.transition);
      return json({ seat: body.success.seat, token, nickname: result.success.nickname }, 201);
    }

    if (request.method === "GET" && action === "socket") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return httpError(426, "UpgradeRequired", "Expected a WebSocket upgrade");
      }
      const seat = seatForToken(state.record, url.searchParams.get("token") ?? "");
      if (seat === undefined) {
        // Browsers cannot read an upgrade's HTTP status, so refuse over the socket itself.
        const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
        server.accept();
        this.send(server, { _tag: "Rejected", reason: "NotSeated", message: "Unknown Seat token" });
        server.close(4001, "Not seated");
        return new Response(null, { status: 101, webSocket: client });
      }
      const result = await this.run(connect(state, seat, now));
      if (result._tag === "Failure") {
        return httpError(409, result.failure.reason, result.failure.message);
      }
      // Existing sockets hear about the arrival; the new socket starts from a Snapshot.
      await this.commit(result.success);
      const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket];
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({ seat, connectedAt: now } satisfies Attachment);
      this.send(server, snapshotFor(result.success.state, seat));
      return new Response(null, { status: 101, webSocket: client });
    }

    return httpError(404, "NotFound", "Unknown route");
  }

  override async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = socket.deserializeAttachment() as Attachment | null;
    const state = this.load();
    if (attachment === null || state === null) return;
    const seatHolder = state.record.seats[attachment.seat];
    const text = typeof message === "string" ? message : new TextDecoder().decode(message);
    const decoded = await Effect.runPromise(Effect.result(decodeClientMessage(text)));
    if (decoded._tag === "Failure") {
      return this.send(socket, {
        _tag: "Rejected",
        reason: "InvalidMessage",
        message: decoded.failure.message,
      });
    }
    if (seatHolder?._tag !== "Player") {
      this.send(socket, {
        _tag: "Rejected",
        reason: "NotSeated",
        message: "This Seat was released",
      });
      return socket.close(4001, "Seat released");
    }
    const result = await this.run(
      receive(state, attachment.seat, decoded.success, await this.now()),
    );
    if (result._tag === "Failure") return this.send(socket, rejectionMessage(result.failure));
    await this.commit(result.success);
  }

  override async webSocketClose(socket: WebSocket): Promise<void> {
    await this.dropSocket(socket);
    // The client's code may be reserved (1005, 1006), so always answer with a normal closure.
    if (socket.readyState !== WebSocket.CLOSED) socket.close(1000, "Closed");
  }

  override async webSocketError(socket: WebSocket): Promise<void> {
    await this.dropSocket(socket);
  }

  /** Marks the Seat disconnected once its last socket is gone. */
  private async dropSocket(socket: WebSocket): Promise<void> {
    const attachment = socket.deserializeAttachment() as Attachment | null;
    const state = this.load();
    if (attachment === null || state === null) return;
    const stillOpen = this.ctx
      .getWebSockets()
      .some(
        (other) =>
          other !== socket &&
          other.readyState === WebSocket.OPEN &&
          (other.deserializeAttachment() as Attachment | null)?.seat === attachment.seat,
      );
    if (stillOpen) return;
    const result = await this.run(disconnect(state, attachment.seat, await this.now()));
    if (result._tag === "Success") await this.commit(result.success);
  }

  override async alarm(): Promise<void> {
    const state = this.load();
    if (state === null) return;
    const now = await this.now();

    // Liveness: a socket that stopped pinging is gone.
    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment() as Attachment | null;
      const lastPing =
        this.ctx.getWebSocketAutoResponseTimestamp(socket)?.getTime() ??
        attachment?.connectedAt ??
        now;
      if (now - lastPing > LIVENESS_TIMEOUT_MILLIS) {
        socket.close(4000, "Missed pings");
        await this.dropSocket(socket);
      }
    }

    const current = this.load() ?? state;
    if (now >= current.record.lastActivityAt + RETENTION_MILLIS) {
      for (let match = 1; match <= current.record.match; match++) {
        const finished = match < current.record.match || current.record.status === "finished";
        await this.exportMatch(match, !finished);
      }
      for (const socket of this.ctx.getWebSockets()) socket.close(1001, "Table expired");
      this.cached = null;
      await this.ctx.storage.deleteAll();
      return;
    }

    const result = await this.run(runDue(current, now));
    if (result._tag === "Success") await this.commit(result.success);
    else await this.schedule();
  }
}
