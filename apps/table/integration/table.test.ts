import { heuristicBot } from "@tichu/bots";
import {
  PING,
  PONG,
  decodeServerMessage,
  defaultTableSettings,
  paths,
  type ClientMessage,
  type ServerMessage,
} from "@tichu/protocol";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";
import { PORT } from "./setup.ts";

const base = `http://localhost:${PORT}`;

const post = (path: string, body: unknown) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

/** A WebSocket client that decodes every server message and lets the test await one. */
const open = (tableId: string, token: string) => {
  const socket = new WebSocket(`ws://localhost:${PORT}${paths.socket(tableId)}?token=${token}`);
  const received: Array<ServerMessage> = [];
  const waiters: Array<() => void> = [];
  socket.addEventListener("message", (message) => {
    if (message.data === PONG) {
      received.push({ _tag: "Rejected", reason: "InvalidMessage", message: PONG });
    } else {
      received.push(Effect.runSync(decodeServerMessage(String(message.data))));
    }
    for (const wake of waiters.splice(0)) wake();
  });
  const until = async (predicate: (message: ServerMessage) => boolean, timeout = 20_000) => {
    const deadline = performance.now() + timeout;
    for (;;) {
      const found = received.find(predicate);
      if (found !== undefined) return found;
      if (performance.now() > deadline) return Promise.reject(new Error("timed out waiting"));
      await new Promise<void>((resolve) => {
        waiters.push(resolve);
        setTimeout(resolve, 250);
      });
    }
  };
  const send = (message: ClientMessage) => socket.send(JSON.stringify(message));
  const opened = new Promise<void>((resolve) => socket.addEventListener("open", () => resolve()));
  return { socket, received, until, send, opened };
};

describe("Table Worker", () => {
  it("runs a lobby, starts with Bots, plays, and resumes after a reconnect", async () => {
    const created = await post(paths.tables, { settings: defaultTableSettings });
    expect(created.status).toBe(201);
    const { tableId } = (await created.json()) as { tableId: string };

    const joined = await post(paths.seats(tableId), { nickname: "Anna", seat: 0 });
    expect(joined.status).toBe(201);
    const { token } = (await joined.json()) as { token: string };
    expect((await post(paths.seats(tableId), { nickname: "Bo", seat: 0 })).status).toBe(409);

    const refused = new WebSocket(
      `ws://localhost:${PORT}${paths.socket(tableId)}?token=${"0".repeat(32)}`,
    );
    const outcome = await new Promise((resolve) => {
      refused.addEventListener("open", () => resolve("open"));
      refused.addEventListener("error", () => resolve("error"));
    });
    expect(outcome).toBe("error");

    const client = open(tableId, token);
    await client.opened;
    const snapshot = await client.until((message) => message._tag === "Snapshot");
    expect(snapshot).toMatchObject({ you: 0, observation: null });

    client.socket.send(PING);
    await client.until((message) => message._tag === "Rejected" && message.message === PONG);

    client.send({ _tag: "Start" });
    await client.until(
      (message) => message._tag === "Rejected" && message.reason === "WrongStatus",
    );
    for (const seat of [1, 2, 3]) client.send({ _tag: "FillSeat", seat, tier: "heuristic" });
    client.send({ _tag: "Start" });

    // Play as a heuristic Bot until the first Trick is won.
    let answered = "";
    for (;;) {
      const latest = client.received.findLast((message) => message._tag === "Update");
      if (latest?._tag === "Update" && latest.event?._tag === "TrickWon") break;
      const decision = latest?._tag === "Update" ? latest.observation?.decision : undefined;
      if (
        latest?._tag === "Update" &&
        latest.observation !== null &&
        decision &&
        decision.id !== answered
      ) {
        answered = decision.id;
        const command = Effect.runSync(heuristicBot.decide(latest.observation, decision));
        client.send({ _tag: "Answer", decisionId: decision.id, command });
      }
      const count = client.received.length;
      await client.until(() => client.received.length > count);
    }
    const lastSeq = client.received.findLast((message) => message._tag === "Update");

    client.socket.close();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const again = open(tableId, token);
    await again.opened;
    const resumed = await again.until((message) => message._tag === "Snapshot");
    expect(
      resumed._tag === "Snapshot" && lastSeq?._tag === "Update" && resumed.seq >= lastSeq.seq,
    ).toBe(true);
    expect(resumed._tag === "Snapshot" && resumed.observation?.round?.phase).toBe("playing");
    again.socket.close();

    const view = await (await fetch(`${base}${paths.table(tableId)}`)).json();
    expect(view).toMatchObject({ id: tableId, status: "playing", creator: 0 });
  });
});
