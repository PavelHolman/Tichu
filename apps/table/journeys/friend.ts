/**
 * A scripted human for manual user-journey testing: joins a Table over HTTP, keeps a WebSocket
 * open, answers its Decisions like the heuristic Bot, and logs what it sees.
 *
 *   bun friend.ts <tableId> <seat> <nickname> [--leave-after=<ms>] [--idle]
 */
import { heuristicBot } from "@tichu/bots";
import { PING, decodeServerMessage, paths, type ClientMessage } from "@tichu/protocol";
import { Effect } from "effect";

const origin = process.env.TABLE_URL ?? "http://localhost:8787";
const [tableId = "", seatText = "1", nickname = "Friend", ...flags] = process.argv.slice(2);
const flag = (name: string) => flags.find((each) => each.startsWith(`--${name}`));
const leaveAfter = Number(flag("leave-after")?.split("=")[1] ?? 0);
const idle = flag("idle") !== undefined;

const joined = await fetch(`${origin}${paths.seats(tableId)}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ nickname, seat: Number(seatText) }),
});
const joinBody = (await joined.json()) as { token?: string; nickname?: string; message?: string };
if (!joined.ok || joinBody.token === undefined) {
  console.log(`join failed: ${joined.status} ${joinBody.message}`);
  process.exit(1);
}
console.log(`joined as ${joinBody.nickname} in Seat ${seatText}`);

const url = new URL(paths.socket(tableId), origin);
url.protocol = "ws:";
url.searchParams.set("token", joinBody.token);
const socket = new WebSocket(url);
const send = (message: ClientMessage) => socket.send(JSON.stringify(message));
let answered = "";

socket.addEventListener("open", () => {
  console.log("connected");
  setInterval(() => socket.send(PING), 20_000);
  if (leaveAfter > 0) {
    setTimeout(() => {
      console.log("leaving (socket closed)");
      process.exit(0);
    }, leaveAfter);
  }
});
socket.addEventListener("close", (event) => {
  console.log(`closed ${event.code}`);
  process.exit(0);
});
socket.addEventListener("message", (message) => {
  if (message.data === "pong") return;
  const decoded = Effect.runSync(Effect.result(decodeServerMessage(String(message.data))));
  if (decoded._tag === "Failure") return console.log("undecodable message");
  const server = decoded.success;
  if (server._tag === "Rejected") return console.log(`rejected: ${server.message}`);
  if (server._tag === "Update" && server.event !== null) console.log(`event ${server.event._tag}`);
  const decision = server.observation?.decision;
  if (idle || server.observation === null || decision == null || decision.id === answered) return;
  answered = decision.id;
  const command = Effect.runSync(heuristicBot.decide(server.observation, decision));
  setTimeout(() => send({ _tag: "Answer", decisionId: decision.id, command }), 400);
});
