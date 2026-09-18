import type { GameEvent, Observation } from "@tichu/engine";
import {
  PING,
  PING_INTERVAL_MILLIS,
  PONG,
  decodeServerMessage,
  type ClientMessage,
  type ServerMessage,
  type TableView,
} from "@tichu/protocol";
import { Data, Effect, Fiber, Schedule } from "effect";
import { socketUrl } from "./api.ts";

export type ConnectionStatus = "connecting" | "open" | "reconnecting" | "refused" | "closed";

class ConnectionLost extends Data.TaggedError("ConnectionLost")<{
  readonly code: number;
}> {}

/** Close codes after which reconnecting is pointless: closed, expired, or no longer seated. */
const FINAL_CLOSE_CODES = new Set([1000, 1001, 4001]);

/**
 * The live link to a Table: one WebSocket that reconnects with backoff, pings to stay alive, and
 * exposes the latest Table view and Observation as reactive state. The server is authoritative;
 * the client never folds events.
 */
export class TableClient {
  status = $state<ConnectionStatus>("connecting");
  table = $state<TableView | null>(null);
  observation = $state<Observation | null>(null);
  you = $state<number | null>(null);
  seq = $state(0);
  lastEvent = $state<GameEvent | null>(null);
  rejection = $state<string | null>(null);

  private socket: WebSocket | null = null;
  private readonly fiber: Fiber.Fiber<void, ConnectionLost>;
  private readonly listeners = new Set<(event: GameEvent) => void>();

  constructor(
    private readonly tableId: string,
    private readonly token: string,
  ) {
    const session = Effect.callback<never, ConnectionLost>((resume) => {
      const socket = new WebSocket(socketUrl(this.tableId, this.token));
      this.socket = socket;
      let ping: ReturnType<typeof setInterval> | undefined;
      socket.addEventListener("open", () => {
        this.status = "open";
        ping = setInterval(() => socket.send(PING), PING_INTERVAL_MILLIS);
      });
      socket.addEventListener("message", (message) => this.receive(String(message.data)));
      socket.addEventListener("close", (event) => {
        clearInterval(ping);
        resume(Effect.fail(new ConnectionLost({ code: event.code })));
      });
      return Effect.sync(() => {
        clearInterval(ping);
        socket.close(1000);
      });
    });

    const reconnecting = session.pipe(
      Effect.tapError((lost) =>
        Effect.sync(() => {
          this.socket = null;
          if (lost.code === 4001) this.status = "refused";
          else if (FINAL_CLOSE_CODES.has(lost.code)) this.status = "closed";
          else this.status = "reconnecting";
        }),
      ),
      Effect.retry({
        schedule: Schedule.min([Schedule.exponential("500 millis"), Schedule.spaced("10 seconds")]),
        while: (lost) => !FINAL_CLOSE_CODES.has(lost.code),
      }),
      Effect.ignore,
    );
    this.fiber = Effect.runFork(reconnecting);
  }

  private receive(text: string) {
    if (text === PONG) return;
    const decoded = Effect.runSync(Effect.result(decodeServerMessage(text)));
    if (decoded._tag === "Failure") {
      this.rejection = "The server sent something this version does not understand";
      return;
    }
    this.apply(decoded.success);
  }

  private apply(message: ServerMessage) {
    switch (message._tag) {
      case "Snapshot":
        this.seq = message.seq;
        this.table = message.table;
        this.you = message.you;
        this.observation = message.observation;
        this.lastEvent = null;
        this.rejection = null;
        return;
      case "Update":
        this.seq = message.seq;
        this.table = message.table;
        this.observation = message.observation;
        if (message.event !== null) {
          this.lastEvent = message.event;
          for (const listener of this.listeners) listener(message.event);
        }
        return;
      case "Rejected":
        this.rejection = message.message;
        return;
    }
  }

  /** Subscribes to every event as it arrives; returns the unsubscribe function. */
  onEvent(listener: (event: GameEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  send(message: ClientMessage): void {
    this.rejection = null;
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
    else this.rejection = "Not connected; retrying";
  }

  close(): void {
    Effect.runFork(Fiber.interrupt(this.fiber));
  }
}
