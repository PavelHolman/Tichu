# Research: Can the free Cloudflare tier host an authoritative Tichu Table?

Resolves: `../issues/01-cloudflare-durable-objects.md`
Date: 2026-09-17
Method: primary sources only (developers.cloudflare.com, svelte.dev/docs/kit, effect.website, GitHub issues in Effect-TS, sveltejs, cloudflare). Every claim carries the URL it was read from. Claims not backed by a page are marked **UNVERIFIED**.

## Summary

**Recommendation: GO (conditional) for "free Cloudflare with Durable Objects".**

The platform side is fully verified: Durable Objects are on the Workers Free plan (SQLite backend only), the free quotas are far above what a handful of concurrent 4-player Tables need, the WebSocket Hibernation API and Alarms are exactly the primitives a turn-based game with turn timers wants, and Effect 4.0 RC has landed several workerd-specific fixes in the last weeks.

The two conditions:

1. **SvelteKit integration is the unverified part.** `@sveltejs/adapter-cloudflare` has no documented way to export a Durable Object class from the Worker it generates (sveltejs/kit #1712 is still open). The safe, fully documented shape is **two Workers**: the SvelteKit Worker (UI + HTTP) and a small plain Worker that owns the `Table` DO class, bound via `script_name`. The "one Worker, custom `main` that re-exports the SvelteKit handler plus the DO class" pattern is plausible but **UNVERIFIED** by any official doc. Budget a half-day spike before committing.
2. **Effect inside a hibernating DO needs discipline**: any pending `setTimeout`/`setInterval` (i.e. Effect `sleep`, `timeout`, schedules) keeps the DO awake and billing duration; in-memory state is wiped on hibernation, so the Effect runtime must be rebuilt from `ctx.storage` on wake. Turn timers should use the Alarm API, not Effect timers.

Key free-tier numbers (per day): 100,000 Worker requests, 100,000 DO requests, 13,000 GB-s DO duration, 5 M SQLite rows read, 100,000 rows written, 5 GB storage, 100 DO classes, unlimited DO instances; 10 ms CPU per Worker request, 30 s CPU per DO request; 20 incoming WS messages = 1 billed request, outgoing WS messages free.

Fallback if the spike fails or quotas bite: friend's VPS with a Bun server (see "Risks and fallback").

---

## 1. Free Workers plan and Durable Objects

### 1a. Is DO on the free plan?

- Yes. "Durable Objects are available both on Workers Free and Workers Paid plans." On Free: "Only Durable Objects with SQLite storage backend are available."
  Source: https://developers.cloudflare.com/durable-objects/platform/pricing/
- Same statement repeated on the migrations page ("Workers Free plan: Only Durable Objects with SQLite storage backend are available.")
  Source: https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/
- Changelog (2025-04-07): DOs "can now be used with zero commitment on the Workers Free plan"; "Free plan limits apply to Durable Objects compute and storage usage."
  Source: https://developers.cloudflare.com/changelog/post/2025-04-07-durable-objects-free-tier/

### 1b. Free-tier limits

Workers (Free) — https://developers.cloudflare.com/workers/platform/limits/ and https://developers.cloudflare.com/workers/platform/pricing/

| Limit | Free plan |
|---|---|
| Requests | 100,000 / day |
| CPU time per invocation | 10 ms |
| Subrequests per request | 50 |
| Simultaneous open (outbound) connections | 6 — "Outbound WebSocket connections also count toward this limit" |
| Memory per isolate | 128 MB |
| Environment variables | 64 per Worker, 5 KB each |
| Workers per account | 100 |
| Cron triggers | 5 |
| Startup time | "within 1 second" |
| `waitUntil()` | up to 30 s after response |
| HTTP request duration | "no hard limit" |

Durable Objects (Free) — https://developers.cloudflare.com/durable-objects/platform/pricing/

| Metric | Free plan |
|---|---|
| DO requests | 100,000 / day |
| Duration | 13,000 GB-s / day (billed as if each object uses 128 MB) |
| SQLite rows read | 5,000,000 / day |
| SQLite rows written | 100,000 / day |
| Stored data | 5 GB total |

DO hard limits — https://developers.cloudflare.com/durable-objects/platform/limits/

| Limit | Value |
|---|---|
| Number of objects | "Unlimited" |
| DO classes per account | 100 (Free), 500 (Paid) |
| SQLite storage per account | 5 GB (Free) |
| Storage per SQLite-backed object | 10 GB |
| CPU per request | "30 seconds (default) / configurable to 5 minutes"; "Each incoming HTTP request or WebSocket message resets the remaining available CPU time to 30 seconds" |
| Requests per object | soft limit 1,000 / s |
| Simultaneous outgoing connections per request | 6 |
| WebSocket message size | 32 MiB (received) |
| SQLite key + value size | 2 MB; 100 columns/table; 100 KB per statement; 100 bound params |
| Alarm handler wall time | 15 minutes |

WebSocket billing — https://developers.cloudflare.com/durable-objects/platform/pricing/
- "There is no charge for outgoing WebSocket messages, nor for incoming WebSocket protocol pings."
- "a 20:1 ratio is applied to incoming WebSocket messages" — 20 incoming messages count as 1 DO request.
- Each RPC session counts as one request; each `setAlarm()` counts as one row written; each alarm invocation counts as a request.
- Duration is "billed in wall-clock time as long as the Object is active and not eligible for hibernation".

Hibernatable WebSockets per DO: "a maximum of 32,768 WebSocket connections per Durable Object".
Source: https://developers.cloudflare.com/durable-objects/api/state/

Do DO requests count against the Workers 100k/day? The pricing page lists Worker requests and DO requests as separate metrics with separate free quotas; a Worker request that calls a DO incurs one of each. No page states the relationship verbatim — **UNVERIFIED** as an explicit rule, inferred from the separate tables.

Back-of-envelope for Tichu: one Table = 4 sockets. A 60-minute game with ~300 incoming player messages bills ~15 DO requests; even 500 games/day is ~7,500 DO requests plus HTTP page loads, well under 100k. Rows written (100k/day) is the tightest quota: persist state once per trick/turn, not per keystroke, and remember each `setAlarm()` is a row write.

### 1c. Credit card / enablement

**UNVERIFIED (NOT STATED)**: none of the pricing, get-started, FAQ or changelog pages mention a credit-card requirement or an enable step beyond declaring the class in wrangler config. The changelog says "zero commitment".
Sources checked: https://developers.cloudflare.com/workers/platform/pricing/ , https://developers.cloudflare.com/durable-objects/get-started/ , https://developers.cloudflare.com/durable-objects/reference/faq/

---

## 2. WebSocket Hibernation API and Alarms

### 2a. How it works

Sources: https://developers.cloudflare.com/durable-objects/best-practices/websockets/ , https://developers.cloudflare.com/durable-objects/api/websockets/ , https://developers.cloudflare.com/durable-objects/api/state/ , https://developers.cloudflare.com/durable-objects/api/base/

- Worker validates `Upgrade: websocket`, then forwards the request to the DO via `stub.fetch(request)`.
- Inside the DO: `const pair = new WebSocketPair(); this.ctx.acceptWebSocket(server, tags?); return new Response(null, { status: 101, webSocket: client });`
- `ctx.acceptWebSocket` (not `ws.accept()`) is what "allows the Durable Object to be hibernated". Tags: max 10 per socket, 256 chars each; `ctx.getWebSockets(tag?)` lists live sockets after wake.
- Handlers on the DO class: `webSocketMessage(ws, message)`, `webSocketClose(ws, code, reason, wasClean)`, `webSocketError(ws, error)`.
- `ws.serializeAttachment(value)` / `ws.deserializeAttachment()`: per-socket metadata that "persist[s] through hibernation as long as the WebSocket remains healthy". Max 16,384 bytes serialized. Lost if either side closes. (Ideal for seat index + player id.)
- `ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(req, res))`: server answers a matching ping text without waking the DO; both strings max 2,048 chars. `getWebSocketAutoResponseTimestamp(ws)` gives last auto-reply time.
- `ctx.setHibernatableWebSocketEventTimeout(ms)`: max 604,800,000 ms (7 days).
- "Hibernation is only supported when a Durable Object acts as a WebSocket server. Outgoing WebSockets do not hibernate."
- Compat flag `web_socket_auto_reply_to_close` becomes default on 2026-04-07: https://developers.cloudflare.com/workers/configuration/compatibility-flags/

### 2b. Cost and what survives hibernation

- "Billable Duration (GB-s) charges do not accrue during hibernation"; objects "that are idle and eligible for hibernation are not billed for duration, even before the runtime has hibernated them".
  Source: https://developers.cloudflare.com/durable-objects/platform/pricing/
- "In-memory state is reset." "When an event arrives, the Durable Object is re-initialized and its `constructor` runs." "Minimize work in the constructor when using hibernation."
  Source: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- "In-memory state is not preserved across eviction or hibernation".
  Source: https://developers.cloudflare.com/durable-objects/reference/in-memory-state/
- **What prevents hibernation** (directly relevant to Effect): "Events such as alarms, incoming requests, and scheduled callbacks prevent hibernation. This includes `setTimeout` and `setInterval` usage."
  Source: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Survives: SQLite storage, scheduled alarm, socket attachments (16 KiB each), the sockets themselves (up to 32,768).

### 2c. Alarm API (turn timers)

Source: https://developers.cloudflare.com/durable-objects/api/alarms/

- `ctx.storage.setAlarm(msSinceEpoch)` (replaces any existing alarm), `getAlarm()` -> ms or `null`, `deleteAlarm()`, and an `alarm(alarmInfo?)` method on the class with `alarmInfo.retryCount` and `alarmInfo.isRetry`.
- "Each Durable Object is able to schedule a single alarm at a time" — for Tichu that is fine: one pending deadline per Table (current turn / Tichu-call window / abandoned-table cleanup).
- "guaranteed at-least-once execution", "retried automatically when the `alarm()` handler throws", "exponential backoff starting at a 2 second delay", "up to 6 retries".
- The alarm wakes a hibernating DO: "the Durable Object's constructor will be called before invoking the alarm handler if the alarm wakes the Durable Object up from hibernation."
  Source: https://developers.cloudflare.com/durable-objects/examples/durable-object-ttl/
- Docs warn against unconditionally calling `setAlarm` in the constructor; check `getAlarm()` first.
- Minimum granularity and `allowUnconfirmed` option: **UNVERIFIED (NOT STATED)** on the alarms page.
- Alarm handler wall-clock limit: 15 minutes (limits page).

---

## 3. Durable Objects from SvelteKit on adapter-cloudflare

### 3a. Adapter configuration and bindings

Source: https://svelte.dev/docs/kit/adapter-cloudflare

- `adapter({ config, platformProxy: { configPath, environment, persist }, fallback: 'plaintext', routes: { include: ['/*'], exclude: ['<all>'] } })`.
- Wrangler config for the generated Worker: `main: ".svelte-kit/cloudflare/_worker.js"`, `assets: { binding: "ASSETS", directory: ".svelte-kit/cloudflare" }`, `compatibility_date` required, `compatibility_flags: ["nodejs_als"]` (the docs' minimum; use `"nodejs_compat"` for the full Node surface, see 4a).
- In endpoints and hooks: `platform.env` ("KV/DO namespaces, etc."), `platform.ctx`, `platform.caches`, `platform.cf`.
- Typing in `src/app.d.ts`: `interface Platform { env: { YOUR_DURABLE_OBJECT_NAMESPACE: DurableObjectNamespace } }` using `@cloudflare/workers-types`.
- Local run: `wrangler dev .svelte-kit/cloudflare/_worker.js`. Pages `/functions` directory is not supported.
- `adapter-cloudflare-workers` is deprecated in favour of `adapter-cloudflare`: https://svelte.dev/docs/kit/adapter-cloudflare-workers ("You can't use `fs` in Cloudflare Workers").
- **Version caveat**: sveltejs/kit PR #16754 "breaking: Move cloudflare bindings from `platform` to `cloudflare:workers`" was merged 2026-08-28 (`import { env } from 'cloudflare:workers'` replaces `platform.env`). The published docs page still shows `platform.env`. Pin the adapter version and check which API it ships.
  Source: https://github.com/sveltejs/kit/pull/16754

### 3b. Exporting the DO class from the same Worker

- Cloudflare requires the class to be exported from the Worker's main module: `class_name` is "The exported class name of the Durable Object"; `script_name` is "The name of the Worker where the Durable Object is defined, if it is external to this Worker".
  Source: https://developers.cloudflare.com/workers/wrangler/configuration/
- The get-started shows `export class MyDurableObject extends DurableObject` next to the default fetch export.
  Source: https://developers.cloudflare.com/durable-objects/get-started/
- The SvelteKit adapter docs say nothing about extra exports from `_worker.js` — **NOT STATED**.
- Evidence the gap is real:
  - sveltejs/kit issue #1712 "Durable Objects with the Cloudflare adapter" — OPEN. https://github.com/sveltejs/kit/issues/1712
  - sveltejs/kit PR #16705 "Custom worker entrypoints with full Durable Objects support" — draft, maintainers asked to stage it. https://github.com/sveltejs/kit/pull/16705
  - Community plugin `sveltekit-cloudflare-do` "automatically exports Durable Objects to the Cloudflare Worker bundle generated by @sveltejs/adapter-cloudflare" — listed in https://svelte.dev/blog/whats-new-in-svelte-july-2026 (third-party, not vetted here).
- Two candidate patterns:
  1. **Separate Worker for the DO, bound with `script_name`** — every piece is documented by Cloudflare; only the "two deploys" cost. Recommended default.
  2. **Single Worker, custom `main` that imports `.svelte-kit/cloudflare/_worker.js`, re-exports its default handler and adds `export class Table`** — **UNVERIFIED**; no official doc describes it, and PR #16705 exists precisely because it is not supported out of the box.

### 3c. WebSocket upgrade route

- SvelteKit adapter docs contain no statement about WebSockets — **NOT STATED** on https://svelte.dev/docs/kit/adapter-cloudflare or the adapter-cloudflare-workers page.
- Cloudflare's Worker-side pattern: check `request.headers.get('Upgrade') !== 'websocket'` -> `426`; `new WebSocketPair()`; `new Response(null, { status: 101, webSocket: client })`.
  Source: https://developers.cloudflare.com/workers/examples/websockets/
- With a DO: the Worker validates the upgrade, then `return stub.fetch(request)`; the DO returns the 101 response with the client socket.
  Source: https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- Whether the original `Request` must be forwarded unchanged: not stated explicitly by Cloudflare; cloudflare/workerd issue #2468 (closed) shows framework users (Hono) needing to forward the raw request with headers intact. https://github.com/cloudflare/workerd/issues/2468
- Whether a SvelteKit `+server.ts` handler that returns `stub.fetch(request)` (a 101 with `webSocket`) passes through the adapter untouched is **UNVERIFIED**. Safer design: route `/ws/*` to the DO Worker directly (via `run_worker_first` on the SvelteKit side, or a separate hostname/route for the DO Worker) and keep SvelteKit endpoints for HTTP only. This is the spike to run first.

### 3d. Wrangler config shape

Sources: https://developers.cloudflare.com/workers/wrangler/configuration/ , https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/

- "Cloudflare recommends using `wrangler.jsonc` for new projects".
- `durable_objects.bindings: [{ name: "TABLE", class_name: "Table", script_name?: "tichu-table", environment?: "..." }]`.
- SQLite-backed classes (the only kind on Free): legacy form `migrations: [{ tag: "v1", new_sqlite_classes: ["Table"] }]`; the current documented form is `"exports": { "Table": { "type": "durable-object", "storage": "sqlite" } }` ("Classes introduced through `new_sqlite_classes` use `sqlite`, while ... `new_classes` use `legacy-kv`").
- `compatibility_date: "yyyy-mm-dd"` required; `compatibility_flags: ["nodejs_compat"]` (default on for compatibility dates >= 2026-08-04).
- `assets: { directory, binding, html_handling, not_found_handling, run_worker_first }` for the SvelteKit static output.

---

## 4. workerd runtime constraints relevant to Effect.ts

### 4a. `nodejs_compat`

Source: https://developers.cloudflare.com/workers/runtime-apis/nodejs/

- With `nodejs_compat`: fully supported — async context tracking, Buffer, Crypto, Events, File system, HTTP/HTTPS, Net, Path, Process, Stream, Timers, URL, Utilities, Zlib, and more; partial — Console, DNS, Module, OS, Performance hooks, TLS. Non-native modules are unenv polyfills that "will either noop or will throw".
- `nodejs_als` alone enables only `AsyncLocalStorage`.
- `AsyncLocalStorage`: `getStore/run/exit/bind/snapshot` and `AsyncResource` supported; "intentionally omits support for the asyncLocalStorage.enterWith() and asyncLocalStorage.disable()"; no full `async_hooks`.
  Source: https://developers.cloudflare.com/workers/runtime-apis/nodejs/asynclocalstorage/

### 4b. Size, startup, memory

Source: https://developers.cloudflare.com/workers/platform/limits/

- Worker size (uncompressed): 64 MiB on both plans; "There is no compressed size limit". (The older 3 MB / 10 MB gzipped figures are no longer on the page.)
- Startup: Worker must start "within 1 second". A "400 ms startup CPU budget" is quoted in Effect issue #8038 but is not on the Cloudflare limits page — **UNVERIFIED** as a documented number.
- Memory: 128 MB per isolate. Env vars: 64 (Free).

### 4c. Runtime behaviours that bite Effect

- "Timers are only available inside of the Request Context." — `setTimeout` at module scope throws.
  Source: https://developers.cloudflare.com/workers/runtime-apis/web-standards/
- "Date.now() returns the time of the last I/O; it does not advance during code execution"; `performance.timeOrigin` is 0 so `performance.now()` behaves like `Date.now()` and clocks "only advance or increment after I/O occurs" (local dev differs).
  Sources: https://developers.cloudflare.com/workers/runtime-apis/web-standards/ , https://developers.cloudflare.com/workers/runtime-apis/performance/
- `WeakRef` / `FinalizationRegistry`: gated by `enable_weak_ref`, default on since 2025-05-05; finalizer callbacks may never run.
  Source: https://developers.cloudflare.com/workers/configuration/compatibility-flags/
- `queueMicrotask`: **NOT STATED** on those pages (it is a standard V8 feature; assume available, UNVERIFIED).
- In a DO, `setTimeout`/`setInterval` prevent hibernation (see 2b). Implication: do not leave Effect fibers sleeping between turns; drive turn deadlines with `setAlarm` and rebuild the runtime in the constructor from storage.

### 4d. Effect on Workers — known reports

Effect-TS/effect (v4 line):
- #8038 (closed via #8114, Sept 2026): `Effect.fn` Error construction "costs most of a Cloudflare Workers startup budget" — 232 ms of 364 ms CPU for ~1,600 definitions; fixed by skipping capture when `Error.stackTraceLimit = 0`. https://github.com/Effect-TS/effect/issues/8038
- #7930 (merged 2026-09-03): "fix(Scheduler): fall back to a microtask when timers cannot be set" — workerd throws "Disallowed operation called within global scope" for `setTimeout` at module load. https://github.com/Effect-TS/effect/pull/7930
- #7927 (merged): "reduce web handler cold start on Cloudflare" (eager layer build). https://github.com/Effect-TS/effect/pull/7927
- #7505 (OPEN): web handler layer build hangs forever after an aborted first request on workerd (error 1101). https://github.com/Effect-TS/effect/issues/7505
- #8205 (OPEN): FetchHttpClient stream conversion drops workerd known-length bodies (R2). https://github.com/Effect-TS/effect/issues/8205
- #4636 (closed, not planned): Config support for Cloudflare bindings. https://github.com/Effect-TS/effect/issues/4636

Effect-TS/effect-smol:
- #2416 (closed): spans land in 1970 on Workers because `performance.timeOrigin === 0`. https://github.com/Effect-TS/effect-smol/issues/2416
- #2179 (closed): RpcServer HTTP hangs under workerd. https://github.com/Effect-TS/effect-smol/issues/2179
- #2216 / #2217 (closed/merged): `@effect/sql-sqlite-do` transactions via `DurableObjectStorage.transaction`. https://github.com/Effect-TS/effect-smol/issues/2216
- #2459 (closed, no comments): "Add cloud flare worker support". https://github.com/Effect-TS/effect-smol/issues/2459

Effect docs: the v4 API index lists `@effect/sql-sqlite-do` and `@effect/sql-d1` but no `platform-cloudflare` package (only browser/bun/deno/node). No official "Effect on Workers" page exists; official Workers support is **NOT STATED**. The volume of merged workerd fixes on the 4.0 line shows it is actively accommodated (inference, UNVERIFIED as policy).
Source: https://effect.website/docs/v4/api

Practical takeaways: set `Error.stackTraceLimit = 0` in production; keep the number of `Effect.fn` definitions modest; build layers eagerly at module scope only where no timers are involved; use `@effect/sql-sqlite-do` for Table persistence; expect to write a thin custom adapter between the DO handlers (`fetch`, `webSocketMessage`, `alarm`) and the Effect runtime.

---

## 5. Static-only hosts

No. GitHub Pages is "a static site hosting service that takes HTML, CSS, and JavaScript files" (https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages) and GitLab Pages states "Dynamic server-side processing ... is not supported" (https://docs.gitlab.com/user/project/pages/); neither can run a WebSocket server, so they can only host the client if the Table server lives elsewhere.

---

## Risks and fallback

| Risk | Severity | Mitigation |
|---|---|---|
| adapter-cloudflare cannot export the DO class (kit #1712 open) | High, but bounded | Two-Worker layout with `script_name` binding; spike the single-Worker custom `main` pattern for one afternoon at most |
| SvelteKit endpoint may not pass a 101 `webSocket` Response through untouched (UNVERIFIED) | Medium | Route `/ws/*` to the DO Worker directly, not through SvelteKit |
| Adapter API churn (`platform.env` -> `cloudflare:workers` env, kit #16754) | Low | Pin adapter version; isolate binding access in one module |
| Effect timers keep the DO awake, burning the 13,000 GB-s/day duration quota | Medium | Turn timers via `setAlarm`; no long-lived sleeping fibers; verify hibernation with `wrangler tail` |
| In-memory Effect runtime lost on hibernation | Medium | Persist authoritative state to SQLite per turn; rebuild in constructor; store seat/player in socket attachments |
| 100,000 rows written/day | Low at expected scale | Batch writes per turn; note each `setAlarm` is a row write |
| Effect on workerd is community-supported, not official; open issues #7505, #8205 | Medium | Avoid Effect web-handler layer for the DO fetch path if #7505 bites; keep the DO surface small and plain |
| 10 ms CPU per Worker request on the SvelteKit side | Low | SSR is light; heavy logic runs in the DO (30 s budget) |

**Fallback (if spike fails or quotas are exceeded):** friend's VPS running a Bun server. Bun ships a native WebSocket server, so the Table actor moves to an in-process object keyed by table id with SQLite (bun:sqlite) for persistence; the Effect code stays the same, the transport adapter changes. SvelteKit would then deploy with `adapter-node` (or the static client on GitHub/GitLab Pages pointing at the VPS WebSocket URL). Cost: no hibernation model, single region, you own uptime and TLS.

## Sources fetched

Cloudflare: /durable-objects/platform/pricing/, /durable-objects/platform/limits/, /workers/platform/limits/, /workers/platform/pricing/, /durable-objects/best-practices/websockets/, /durable-objects/api/alarms/, /durable-objects/api/websockets/, /durable-objects/api/state/, /durable-objects/api/base/, /durable-objects/get-started/, /durable-objects/reference/in-memory-state/, /durable-objects/reference/faq/, /durable-objects/reference/durable-objects-migrations/, /durable-objects/examples/durable-object-ttl/, /workers/runtime-apis/nodejs/, /workers/runtime-apis/nodejs/asynclocalstorage/, /workers/runtime-apis/websockets/, /workers/runtime-apis/web-standards/, /workers/runtime-apis/performance/, /workers/wrangler/configuration/, /workers/configuration/compatibility-flags/, /workers/examples/websockets/, /changelog/post/2025-04-07-durable-objects-free-tier/ (all under https://developers.cloudflare.com).
Svelte: https://svelte.dev/docs/kit/adapter-cloudflare , https://svelte.dev/docs/kit/adapter-cloudflare-workers , https://svelte.dev/blog/whats-new-in-svelte-july-2026.
GitHub: sveltejs/kit #1712, #16705, #16754; Effect-TS/effect #4636, #7505, #7927, #7930, #8038, #8205; Effect-TS/effect-smol #2179, #2216, #2416, #2459; cloudflare/workerd #2468.
Effect: https://effect.website/docs/v4/api.
Static hosts: https://docs.github.com/en/pages/getting-started-with-github-pages/about-github-pages , https://docs.gitlab.com/user/project/pages/.
