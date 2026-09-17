# Map: Tichu web app

Label: wayfinder:map
Tracker: local markdown (see `.scratch/tichu/issues/`)

## Destination

**Reached 2026-09-17: see `spec.md`.**

A handoff spec at `.scratch/tichu/spec.md`: stack, architecture, domain model, realtime protocol, persistence, bot interface, and UI direction all decided, with nothing left to decide before build tickets are cut. Scope is standard Tichu for four Participants (humans and simple Bots), synchronous play, joined by link, plus the Grand Seigneur Variant designed on the same engine (pulled in 2026-09-17).

## Notes

Domain: the Tichu card game. Glossary lives in `CONTEXT.md`; every ticket uses its terms.

ADRs so far: `docs/adr/0001` (pure engine, kernel-versus-Variant seam) and `docs/adr/0002` (Durable Objects hosting, Bun as tooling).

Skills every session should consult: `domain-modeling` (keep `CONTEXT.md` sharp), `grilling` for grilling tickets, `prototype` for prototype tickets, `research` for research tickets.

Standing preferences settled while charting (2026-09-17):

- **Destination shape**: spec, not build. Execution is not carried in this map.
- **Rules**: standard Tichu first, built on an engine parametrised by Layout with a kernel-versus-Variant seam. Grand Seigneur is designed in this map; other Variants come later.
- **Access**: room link plus nickname, no accounts.
- **Play mode**: synchronous only. Server authoritative, every Table state persistent, so async can be added later.
- **Platform**: PWA built with SvelteKit, mobile-first portrait, English-only UI.
- **Runtime and host**: Cloudflare Workers plus Durable Objects on the free tier, one Durable Object per Table, WebSockets between client and Table. Bun 1.4 is tooling only (package manager, scripts, runner), not the production runtime. Fallback if research kills this: a friend's VPS running a Bun server.
- **Language and libraries**: TypeScript everywhere. Effect.ts exact-pinned to `4.0.0-rc.115` (confirmed by Pavel 2026-09-17) for DI, errors, resiliency, schemas, in the shared core, the server, and client services. Svelte 5 components stay plain and call an Effect runtime at the boundary. shadcn-svelte with Tailwind v4.
- **Tooling**: Vite, oxfmt, oxlint, husky, lint-staged, conventional commits. Vitest with `@effect/vitest`; property tests for the rules engine. Lint rules forbid `throw` and the `Date` object; time uses the Temporal API via `temporal-polyfill` (confirmed by Pavel 2026-09-17).
- **Persistence**: live Table state for rejoin, plus an append-only event log per Match (future bot training data).
- **Bots**: random and heuristic Bots are in scope. A stable Bot interface is guaranteed so search and learned Bots can plug in later.
- **Robustness**: mixed human and Bot Tables, a Bot takes over a disconnected Seat, Players rejoin from the link.

## Decisions so far

<!-- one line per resolved ticket: [title](issues/NN-slug.md): gist -->
- [Can the free Cloudflare tier host an authoritative Tichu Table?](issues/01-cloudflare-durable-objects.md): conditional GO. Free-tier Durable Objects suffice; the Table DO lives in a separate Worker (SvelteKit adapter cannot export one); timers via the Alarm API; VPS with Bun is the fallback.
- [What does Effect 4.0 RC4 give us and what does it break?](issues/02-effect-4-rc.md): adopt v4 RC exact-pinned (rc tag is 4.0.0-rc.115, there is no "RC4"); runs on workerd without nodejs_compat; @effect/vitest needs Vitest 5; built-in arbitraries replace fast-check.
- [What is the canonical rule set, and which edge cases must the engine decide?](issues/04-tichu-rules-reference.md): 80 cited rules from the Fata Morgana sources and 59 edge cases (13 officially unspecified, 5 where implementations diverge); official variants are Trichu, Tientsin and Grand Seigneur.
- [How do we enforce Temporal-only time and no-throw with oxlint, and where does Temporal run?](issues/03-temporal-and-lint.md): temporal-polyfill 1.0.5 wired in both SvelteKit hooks (workerd and Safari lack Temporal); Date ban is native oxlint, throw ban needs the oxlint JS plugin API; oxfmt beta with experimental Svelte; husky, lint-staged, commitlint under Bun.
- [How is the rules engine modelled?](issues/05-rules-engine-model.md): pure command-in, events-out engine with `legalPlays` as the single legality source; kernel (Deck, Combinations, Tricks, Wish) versus Variant (Layout, deal, Exchange, scoring, Match state) seam; Layout-parametrised from day one; first-come Bombs, simultaneous Grand Tichu, explicit Phoenix rank, strict Wish, auto Dragon Gift only when moot.
- [What is the Bot interface?](issues/09-bot-interface.md): pure `decide` and `react` functions over the same Observation humans get, legal options supplied by the engine, per-Decision time budget with random fallback; kernel `replay` and plain-data observations guarantee future search and learned Bots fit.
- [What are the canonical Grand Seigneur rules and where are they ambiguous?](issues/15-grand-seigneur-rules.md): 37 cited rules and 18 ambiguities; needs only the two reserved kernel options plus finishing-order events and an optional Dragon Gift; no Match end is defined by the rules.
- [What do the client and the Table say to each other?](issues/07-realtime-protocol.md): one WebSocket per client, Effect Schema messages, every message carries the event plus the Seat's Observation, full snapshot on every connect; Seat tokens as the only credential; heuristic Bot takes over a disconnected Seat after a 30 s Alarm; Table HTTP routes live on the Table Worker.
- [How are Table state and the Match event log stored?](issues/08-persistence-and-event-log.md): raw DO SQLite, append-only events table folded on wake, no snapshots; Match logs exported as JSONL to R2, Table storage deleted 7 idle days after last connection.
- [How does a Table get created, joined, and started?](issues/12-lobby-and-joining.md): pick Variant and settings, short unguessable link, nickname plus chosen Seat, creator fills with Bots and starts; any Player may release a disconnected Seat; rematch for standard Tichu, creator-closed open-ended Table for Grand Seigneur.
- [How is the Grand Seigneur Variant modelled on the kernel?](issues/16-grand-seigneur-model.md): Teams of one for 5 to 12 Seats, two Decks from seven, hierarchy ranks as Match state, forced 3/2/1 Exchange with sighted return, Mah Jong holder leads, no Calls or scoring, open-ended Match; research defaults adopted otherwise.
- [Can the free tier hold the Match event-log corpus in R2?](issues/18-r2-export.md): GO; 10 GB free, DO binds R2 directly, corpus is about 540 MB after three years; enabling R2 needs a payment method on file once.
- [Spike: does a SvelteKit Worker plus a separate Table Durable Object Worker actually work end to end?](issues/14-sveltekit-do-spike.md): yes under wrangler dev; Effect 4 rc.115 boots in a SQLite DO with nodejs_compat, hibernation sockets and Alarms work, cross-Worker DO binding resolves; the browser must open its WebSocket directly to the Table Worker; single-Worker variant is a fallback only.
- [How is the monorepo laid out and wired up?](issues/06-repo-layout-and-tooling.md): Bun workspaces (engine, bots, protocol, web, table); exact pins on Effect rc.115, adapter 7.2.9, wrangler 4.133; oxlint with built-in Date ban and plugin throw ban, oxfmt, husky, lint-staged, commitlint; Vitest 5 with @effect/vitest and built-in arbitraries; temporal-polyfill in both hooks and the Worker entry; multi-config wrangler dev.
- [How do cards look on a phone?](issues/10-card-art-prototype.md): variant D on branch `prototype/card-art`: solid suit-colour faces with white rank, specials in violet with original icons, Hand as one overlapping row with corner ranks, tap lifts a card.
- [How does the Table look and feel during a Trick?](issues/11-table-layout-prototype.md): variant A on branch `prototype/table-layout`: ring layout with partner top and opponents left and right, winning Play centred with a one-line Trick history, single-row Hand, full-width Pass and Play, prompts as a sheet, reconnect as a banner.
- [How does a Table with 5 to 12 Seats look on a phone?](issues/17-large-table-layout-prototype.md): variant A on branch `prototype/large-table`: the ring generalises to an oval with hierarchy badges; forced-give Exchange is confirm-only, return is pick-any-N; no second screen.
- [Assemble the handoff spec](issues/13-assemble-spec.md): written at `spec.md`; the map is complete.

## Not yet specified

- **Further Variants**: Trichu (3 Seats, dummy partner) and Tientsin (6 Seats, Teams of three) are wanted eventually; each becomes a Variant on the kernel seam. Rule-level options too: sequential official Grand Tichu, an explicit Bomb window, fixed-Rounds Matches, the Abacus 200-point Wish penalty.
- **Offline and install behaviour of the PWA**: what the service worker caches and how the client shows a dropped socket while it retries. Sharpens with the Table layout prototype, where the reconnecting state gets a screen.

## Out of scope

- Accounts, persistent identity, stats, Elo, ranked play.
- Chat and spectating.
- App-store or native wrapper release.
- Asynchronous play over days and push notifications (design keeps the door open, nothing more).
- Search (ISMCTS) and learned (REINFORCE-style) Bots. Only the Bot interface is decided here.
- Finished-match browsing.
