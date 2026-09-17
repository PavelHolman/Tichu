# Tichu web app: handoff spec

Assembled 2026-09-17 from the wayfinder map at `map.md`. Every section gists a decision and links the ticket that holds the detail; the ticket is authoritative. Glossary: `CONTEXT.md` at the repo root. ADRs: `docs/adr/0001` (engine shape and seam) and `docs/adr/0002` (hosting and runtime).

## 1. What we are building

A progressive web app where friends play Tichu at a shared Table, joined by link with a nickname, no accounts. Four-Participant standard Tichu with random and heuristic Bots filling empty Seats, plus the Grand Seigneur Variant (5 to 12 Seats, individual play). Synchronous play only. The server is authoritative and every Table is persistent, so asynchronous play can be added later without redesign.

Out of scope for this effort: accounts, stats, ranked play, chat, spectating, app-store release, asynchronous play and push notifications, search and learned Bots (only their interface is guaranteed), finished-Match browsing, and the Trichu and Tientsin Variants.

## 2. Architecture

- **Client**: SvelteKit (Svelte 5) PWA on Cloudflare, mobile-first portrait, English only, shadcn-svelte with Tailwind v4. UI only; it never runs the rules engine.
- **Table Worker**: a plain Cloudflare Worker exporting the `Table` Durable Object (SQLite-backed) and owning the Table HTTP routes (create, join) and the WebSocket route. One Durable Object per Table holds authoritative state, runs the engine and the Bots, and persists the event log.
- **Two Workers, not one**: the SvelteKit adapter cannot export a Durable Object class, and routing a WebSocket upgrade through SvelteKit crashes `vite dev`. The browser opens its WebSocket directly to the Table Worker. Verified end to end in [the spike](issues/14-sveltekit-do-spike.md); details in [hosting research](issues/01-cloudflare-durable-objects.md).
- **Hosting**: Workers Free plan. Free-tier Durable Object quotas are far above what a friends group needs. Turn and takeover timers use the Alarm API because JavaScript timers block hibernation. Fallback if Cloudflare fails us: a friend's VPS running a Bun server with adapter-node behind the same engine and protocol.
- **Language**: TypeScript everywhere. Effect (`4.0.0-rc.115`, exact) for DI, typed errors, resiliency and schemas in the engine, the Table Worker and client services; Svelte components stay plain and call an Effect runtime at the boundary. Effect 4 was verified to boot inside a Durable Object on workerd ([Effect research](issues/02-effect-4-rc.md), [spike](issues/14-sveltekit-do-spike.md)).
- **Time**: the Temporal API everywhere, via `temporal-polyfill` (workerd and Safari lack native Temporal), with `Date` and `throw` forbidden by lint ([Temporal and lint research](issues/03-temporal-and-lint.md)).

## 3. Domain model

Terms in `CONTEXT.md`: Table, Seat, Team, Participant, Player, Bot, Variant, Layout, Deck, Match, Round, Hand, Trick, Play, Combination, Pass, Bomb, Call, Exchange, Wish, Dragon Gift, Decision, Reaction, Observation, and the four special cards. A Team is any partition of Seats, so individual play is Teams of one. A Match ends as its Variant defines.

## 4. Rules engine ([ticket](issues/05-rules-engine-model.md), [rules reference](research/tichu-rules-reference.md))

- **Shape**: pure module. A command in, a typed rule error or a list of domain events out; state is the fold of events. `legalPlays(state, seat)` is the single source of legality for UI and Bots. The deal event records the actual Hands; the shuffle uses an injected Effect `Random`. Property-tested with Effect's built-in arbitraries.
- **Kernel** (shared by all Variants): Deck and card identity (rank, suit, copy index), Combination classification and comparison, Trick mechanics, Wish enforcement, special-card behaviour, finishing-order events, a Variant-skippable Dragon Gift. Kernel options: four-suit Bombs, later identical Dragon wins. The kernel exposes `replay(deal, events)` for future search Bots.
- **Variant**: Layout, Deck, deal procedure and Call windows, Exchange, Round end, transfers, scoring, Match-level state. Standard Tichu is the only Variant built now; Grand Seigneur is designed (section 9). The engine is Layout-parametrised from day one.
- **Standard Tichu rule calls**: out-of-turn Bombs are first-come with server ordering and the Trick is collected on the closing Pass; Grand Tichu is simultaneous and private after eight cards; every Play names the Phoenix's rank explicitly; the Wish rides on the Mah Jong's Play, binds any legal Play containing a natural card of the rank, forbids Pass, and forbids the Dog while such a lead exists; the Dragon Gift is a separate Decision, automatic when both opponents are out; target 1000 with play-on ties; atomic Exchange; one irrevocable Call per Participant per Round, allowed until their first Play; a Passer may re-enter; no floor on negative totals.

## 5. Bots ([ticket](issues/09-bot-interface.md))

- Two entry points: `decide(observation, decision)` answers an engine-required Decision with one of its legal options; `react(observation)` may volunteer a Reaction (Call, out-of-turn Bomb) and returns nothing by default.
- Bots see exactly the Observation a human in that Seat sees. Bots are pure functions of (observation, decision, seed) with no private state. Each Decision carries a time budget; on overrun the Table answers with a random legal option.
- Random Bot: uniform over legal options, never Calls. Heuristic Bot: outline on the ticket (Grand Tichu on two of Dragon, Phoenix, Aces; cheapest sufficient beat; Pass when partner is winning; Bomb only around Calls).
- Takeover of a disconnected Seat uses the heuristic Bot through the same interface.

## 6. Realtime protocol ([ticket](issues/07-realtime-protocol.md))

- One WebSocket per client to the Table Durable Object; JSON messages validated by Effect Schema on both ends from the shared protocol package.
- Server to client: the event plus the Seat's resulting Observation with a Table-wide sequence number; a full snapshot on every connect. The client never folds events.
- Client to server: Decision answers name the pending Decision id or are rejected; Reactions are accepted whenever still legal against current state. Rejections are typed errors.
- Identity: the link names the Table; taking a Seat issues a 128-bit Seat token stored in the browser, the sole credential.
- Liveness: client pings every 20 s through the Durable Object auto-response; disconnected after socket close or two missed pings. No turn timer for connected Players. A disconnected Seat with a pending Decision gets a Bot answer after a 30 s Alarm (Table setting) until the Player returns. Reactions are never made on a disconnected Player's behalf.

## 7. Persistence ([ticket](issues/08-persistence-and-event-log.md), [R2 research](issues/18-r2-export.md))

- Raw Durable Object SQLite: an append-only `events` table (sequence, timestamp, event JSON) and one Table row (Variant, settings, Seats, tokens, creator, timestamps). Live state folds on wake; no snapshots.
- Export: at Match end (standard) or Table close (Grand Seigneur), the event log goes to R2 as one JSONL object, the future training corpus. Free tier suffices; enabling R2 needs a payment method on file once. Fallback: a corpus Durable Object.
- Retention: an Alarm deletes Table storage 7 days after the last connection; an unfinished Match is exported as partial first.

## 8. Lobby and Table lifecycle ([ticket](issues/12-lobby-and-joining.md))

Create: pick a Variant and settings, get a short unguessable link. Join: nickname (unique per Table) and choose an empty Seat; Seat count and Team shape come from the Layout. The creator fills empty Seats with Bots and starts when the Layout is full. Full running Table: "in progress, no free Seat". Any connected Player may release a disconnected Seat or hand it to a Bot; only the creator starts, closes or changes settings, and the role passes to the longest-connected Player if the creator's Seat is released. Standard Tichu offers a rematch; Grand Seigneur runs until the creator closes the Table.

## 9. Grand Seigneur ([ticket](issues/16-grand-seigneur-model.md), [rules](research/grand-seigneur-rules.md))

5 to 12 Seats as Teams of one. One Deck minus the Dog, or from seven Participants two Decks minus both Dogs and the second Mah Jong. Kernel options on: four-suit Bombs, later Dragon wins. Match state is the hierarchy from the previous finishing order; Seats renumber to preserve the printed play order. Forced Exchange 3/2/1 by rank (2/1/0 at five), best defined as Dragon, Phoenix, Mah Jong, then Ace down; recipients return any cards sighted. Mah Jong holder leads; no Calls, no scoring, no Dragon Gift; identical cards never beat each other; open-ended Match closed by the creator.

## 10. UI direction (prototypes on branches `prototype/card-art`, `prototype/table-layout`, `prototype/large-table`)

- **Cards** ([ticket](issues/10-card-art-prototype.md)): original SVG art. Solid suit-colour faces (Jade green, Sword blue, Pagoda red, Star yellow) with a huge white rank and a small corner rank; specials in violet with simple icons. Hand as one overlapping row sorted low to high; tap lifts a card.
- **Four-Seat Table** ([ticket](issues/11-table-layout-prototype.md)): ring layout, partner top, opponents left and right with card backs, counts, Call badges and turn marker; winning Play centred with a one-line Trick history; full-width Pass and Play under the Hand; Wish and Dragon Gift as a sheet above the Hand; reconnecting as a top banner naming the takeover Bot and grace period.
- **Large Table** ([ticket](issues/17-large-table-layout-prototype.md)): the ring generalises to an oval with hierarchy badges; forced-give Exchange is a highlighted-cards confirm; return is pick-any-N.

## 11. Repository and tooling ([ticket](issues/06-repo-layout-and-tooling.md))

Bun workspaces: `packages/engine`, `packages/bots`, `packages/protocol`, `apps/web`, `apps/table`. Bun is tooling only. Exact pins on Effect rc.115, adapter-cloudflare 7.2.9, wrangler 4.133; Vitest 5 with `@effect/vitest`. oxlint with the built-in Date ban and a plugin-based throw ban (two allow-listed files), oxfmt with Svelte support, husky, lint-staged, commitlint with package scopes. `temporal-polyfill` at the top of both SvelteKit hooks and the Worker entry. Local dev: one multi-config `wrangler dev`; `vite dev` for pure UI.

## 12. Fog left for later efforts

Offline and install behaviour of the PWA (service worker caching, reconnect screen), further Variants (Trichu, Tientsin) and rule options (sequential Grand Tichu, explicit Bomb window, fixed-Rounds Matches, Abacus Wish penalty). Nothing here blocks building what is above.

## 13. Suggested build order

1. `packages/engine` kernel and standard Variant with property tests, from section 4 and the rules reference.
2. `packages/protocol` schemas and `packages/bots` random and heuristic.
3. `apps/table`: Durable Object, event log, WebSocket, Alarms, export.
4. `apps/web`: lobby, four-Seat Table, card components from the prototypes.
5. Grand Seigneur Variant and the large Table.
