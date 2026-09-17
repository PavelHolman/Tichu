# 01 Can the free Cloudflare tier host an authoritative Tichu Table?

Type: research
Status: resolved
Blocked by: 
Map: ../map.md

## Question

Confirm from Cloudflare's own docs whether the free Workers plan includes Durable Objects (SQLite-backed), the limits that matter for four-player Tables (requests, storage, CPU time, WebSocket hibernation, concurrent connections, DO count), and how SvelteKit's Cloudflare adapter exposes a Durable Object binding and a WebSocket upgrade route. Also note the workerd runtime constraints that affect Effect.ts (no Node APIs, bundle size, cold start). Deliverable: a findings file at `.scratch/tichu/research/cloudflare-durable-objects.md` with a go or no-go recommendation and the fallback if no-go.

## Answer

**Conditional GO** for free Cloudflare with Durable Objects. Findings with citations: [research/cloudflare-durable-objects.md](../research/cloudflare-durable-objects.md).

- Durable Objects are on the Workers Free plan, SQLite backend only. Daily free quotas: 100k Worker requests, 100k DO requests, 13,000 GB-s DO duration, 5M rows read, 100k rows written, 5 GB storage. Plenty for a friends group.
- CPU: 10 ms per Worker request, 30 s per DO request. 20 incoming WebSocket messages bill as one request; outgoing are free.
- WebSocket Hibernation drops in-memory state; socket attachments (16 KiB) and SQLite survive. `setTimeout` blocks hibernation, so **turn timers must use the Alarm API** (one alarm per DO, at-least-once).
- **Main gap**: SvelteKit's adapter-cloudflare has no documented way to export a DO class from its generated worker (sveltejs/kit #1712). Decision: the Table Durable Object lives in a **separate Worker** bound via `script_name`, with `/ws/*` routed straight to it, not through a SvelteKit endpoint. Whether a 101 upgrade passes through the adapter is UNVERIFIED, so do not rely on it.
- Adapter churn: kit PR #16754 moves bindings from `platform.env` to `cloudflare:workers`; pin the adapter version.
- workerd: enable `nodejs_compat`; limits 64 MiB bundle, 1 s startup, 128 MB memory; timers only in request context; `Date.now()` frozen between I/O.
- Effect 4.0 RC has recent workerd fixes merged; two open issues remain (#7505, #8205). Set `Error.stackTraceLimit = 0` in production.
- Static hosts (GitHub or GitLab Pages) cannot run the WebSocket server.
- **Fallback**: friend's VPS running a Bun server with adapter-node, same Effect core behind a different transport adapter.

Consequences for other tickets: repo layout (06) must include the separate DO Worker; the realtime protocol (07) must design timers around Alarms and hibernation; persistence (08) has DO SQLite confirmed.
