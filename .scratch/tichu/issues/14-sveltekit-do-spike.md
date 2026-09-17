# 14 Spike: does a SvelteKit Worker plus a separate Table Durable Object Worker actually work end to end?

Type: task
Status: resolved
Blocked by: 02
Map: ../map.md

## Question

Throwaway spike, AFK: a minimal SvelteKit app on adapter-cloudflare, a second plain Worker exporting a `Table` Durable Object bound via `script_name`, a `/ws/*` route reaching the DO with a WebSocket upgrade, hibernation on, one Alarm firing, and an Effect 4 RC runtime booting inside the DO with `nodejs_compat`. Run it under `wrangler dev` (deploy only if the user has a Cloudflare account ready). Record: what worked, the exact wrangler config for both Workers, whether the single-Worker variant (custom `main` re-exporting the SvelteKit handler plus the DO class) works, cold-start time, and any Effect incompatibility. This unblocks the repo layout decision. Facts, not code, are the deliverable; the spike is deleted afterwards.

## Answer

Spike run 2026-09-17 under `wrangler dev` only (no Cloudflare account, no deploy). Full findings, configs, versions and transcripts: [research/sveltekit-do-spike.md](../research/sveltekit-do-spike.md). The throwaway code lives in the session scratchpad and is not kept.

- **Effect 4 `4.0.0-rc.115` boots inside a SQLite Durable Object on workerd** with `nodejs_compat`: Layer, `Context.Service`, `Effect.fn`, Schema decode all ran. Note rc.115 still names the DI module `Context`, not `ServiceMap`.
- **Hibernation WebSocket API** echoes with sequence numbers persisted in SQLite; the Alarm fires at +2.0 s, writes a row and broadcasts.
- **Two-Worker layout works**: the `script_name` DO binding resolves from SvelteKit under one multi-config `wrangler dev -c apps/web -c apps/table` (8 ms) and across separate `vite dev` plus `wrangler dev` processes (175 ms first hit).
- A WebSocket upgrade routed through a SvelteKit endpoint returning the DO stub's response works under `wrangler dev` (real 101) but **crashes `vite dev`**. Decision stands: the browser opens its WebSocket straight to the Table Worker.
- **Single-Worker variant** (custom `main` re-exporting the adapter's `_worker.js` plus the DO class) builds and runs under `wrangler dev` and passes `deploy --dry-run`, but is unusable under `vite dev` because internal DO bindings are not available to the platform proxy. Kept only as a documented fallback.
- **Cold start**: 17 to 40 ms server-side for the first request to a new DO after process start (one-off 362 ms on the very first run); warm 4 to 10 ms. Bundles gzipped: table 139 KiB, web 85 KiB.
- **Errors fixed**: Effect's type declarations need `lib: ESNext, DOM` and `skipLibCheck`; the scaffold build needs `wrangler types` first; importing `cloudflare:workers` in app code breaks `vite build`.
- Adapter 7.2.9 imports `env` from `cloudflare:workers` in its template and still provides `platform.env`; pin the adapter version.
- Local Bun is 1.3.14, not 1.4; nothing in the spike depended on the difference.

Unblocks the tooling half of [How is the monorepo laid out and wired up?](06-repo-layout-and-tooling.md).
