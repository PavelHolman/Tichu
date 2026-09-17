# 07 What do the client and the Table say to each other?

Type: grilling
Status: resolved
Blocked by: 01, 05
Map: ../map.md

## Question

Decide the WebSocket protocol between client and Table: message schemas (Effect Schema), how the Table projects state so each client sees only its own Hand and public information, sequence numbers and resync on reconnect, how a Player rejoins from the link, when a Bot takes over a Seat and hands it back, and turn timers if any. Decide how Bots run inside the Table Durable Object.

Note (from the Bot interface resolution): the per-Seat state projection is the Observation from CONTEXT.md and is shared by human clients and Bots, so it must carry the Round's public event history. Decisions and Reactions are the two message shapes the client answers with. Takeover trigger and timing are decided here; the takeover Bot is the heuristic tier through the normal interface.

## Answer

Resolved by grilling with Pavel, 2026-09-17 (the "grill everything" session).

- **Transport**: one WebSocket per client to the Table Durable Object. Messages are JSON validated by Effect Schema on both ends, defined once in the shared protocol package.
- **Server to client**: every message carries the event and the Seat's resulting **Observation** (the CONTEXT.md term), with a Table-wide sequence number. The client never folds events; the engine does not run in the browser. The event is for animation and history display.
- **Connect and reconnect**: the server always sends a full Observation snapshot first, then streams. No partial catch-up.
- **Client to server**: a Decision answer names the pending Decision's id or is rejected. A Reaction (Call, out-of-turn Bomb) carries the sequence number the client saw but is accepted whenever it is still legal against current state. Rejections are typed errors, never dropped.
- **Identity**: the link identifies the Table; taking a Seat issues a 128-bit random Seat token stored in the browser, the sole rejoin credential.
- **Liveness**: client pings every 20 seconds via the Durable Object WebSocket auto-response, which preserves hibernation. Disconnected means socket close or two missed pings.
- **Takeover**: no turn timer for connected Players. When a Seat is disconnected and a Decision is pending, an Alarm fires after a grace period (default 30 s, a Table setting) and the heuristic Bot answers; it keeps answering until the Player reconnects. Reactions are never made on a disconnected Player's behalf. The creator can hand a Seat to a Bot permanently.
- **Bots** run inside the Table Durable Object through the Bot interface; their Decisions are ordinary commands.
- **HTTP surface**: creating a Table and joining a Seat are HTTP calls on the Table Worker under the same path prefix as the WebSocket. SvelteKit serves UI only.
