---
status: accepted
---

# One Durable Object per Table on the Cloudflare free tier; Bun is tooling, not the runtime

Each Table is a Cloudflare Durable Object holding authoritative state, its SQLite event log, and the Players' WebSockets, deployed on the Workers Free plan. Bun 1.4 is the package manager, script runner and test runner, but production code runs on workerd, so nothing may depend on Bun or Node APIs. The Table Durable Object lives in its own Worker because the SvelteKit Cloudflare adapter cannot export a Durable Object class; SvelteKit serves UI only and the Table Worker owns the HTTP and WebSocket routes.

## Considered options

A Bun server on a friend's VPS was kept as the fallback: same engine and protocol behind a different transport adapter, at the cost of doing our own operations. Static hosts (GitHub or GitLab Pages) cannot run an authoritative WebSocket server at all.

## Consequences

Turn and takeover timers must use the Durable Object Alarm API, since pending JavaScript timers block hibernation. In-memory state is rebuilt from the event log on every wake.
