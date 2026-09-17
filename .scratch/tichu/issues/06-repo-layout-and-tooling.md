# 06 How is the monorepo laid out and wired up?

Type: grilling
Status: resolved
Blocked by: 01, 02, 03, 14
Map: ../map.md

## Question

Decide the Bun workspace layout (for example packages/core for Table and rules, packages/bots, apps/web for SvelteKit including the Durable Object), the toolchain config for oxlint, oxfmt, husky, lint-staged, commitlint, Vitest with @effect/vitest, and the lint rules that forbid Date and throw. Decide Effect version pinning based on the Effect research. Output is a spec section plus the exact config files to create.

## Decided so far (ticket stays open for the tooling half, pending the spike)

Bun workspaces: `packages/engine` (kernel and Variants as internal modules, no I/O), `packages/bots`, `packages/protocol` (Effect Schemas for events, Observation, Decisions, Reactions), `apps/web` (SvelteKit on Cloudflare, UI only), `apps/table` (plain Worker exporting the Table Durable Object plus the Table HTTP routes). Decided with Pavel 2026-09-17. Still open: the exact oxlint, oxfmt, husky, lint-staged, commitlint and Vitest 5 configs, and the two-Worker wrangler wiring, after the SvelteKit spike reports.

## Answer

Resolved by grilling with Pavel, 2026-09-17. Config snippets with citations: [research/temporal-and-lint.md](../research/temporal-and-lint.md), [research/effect-4-rc.md](../research/effect-4-rc.md), and the working wrangler configs in [research/sveltekit-do-spike.md](../research/sveltekit-do-spike.md).

**Layout**: Bun workspaces with `packages/engine`, `packages/bots`, `packages/protocol`, `apps/web` (SvelteKit on Cloudflare, UI only), `apps/table` (plain Worker with the Table Durable Object and the Table HTTP and WebSocket routes). See "Decided so far" above.

**Pins**: exact versions, lifted in lockstep only: `effect`, `@effect/vitest`, `@effect/platform-browser` at `4.0.0-rc.115`; `@sveltejs/adapter-cloudflare` 7.2.9; wrangler 4.133. Node 22.12 or newer (Vitest 5). Bun is the package manager, script runner and Vitest launcher; the local Bun is 1.3.14.

**Lint**: oxlint. Date ban via built-in `no-restricted-globals` (with `checkGlobalObject`) plus `typescript/no-restricted-types`. Throw ban via the oxlint JS plugin API running `no-restricted-syntax` on `ThrowStatement` through `oxlint-plugin-eslint`. Two allow-listed files: the Effect-to-Temporal bridge and the Table Worker entry. No manual or scripted check of `.svelte` script blocks (Pavel's call); if the plugin's Svelte coverage proves missing, revisit then.

**Format**: oxfmt 0.68 for TypeScript and JSON with Svelte support on. Fallback only if it misbehaves: Prettier plus `prettier-plugin-svelte` scoped to `*.svelte`.

**Hooks and commits**: husky 9, lint-staged 17 running oxlint and oxfmt on staged files, commitlint 21 with `config-conventional`. Scopes: `engine`, `bots`, `protocol`, `web`, `table`.

**Tests**: Vitest 5 with `@effect/vitest`; `it.effect` and `TestClock` for the engine; `it.effect.prop` with `effect/unstable/arbitrary` for property tests; a small `wrangler dev` driven integration suite for the Table Worker seeded from the spike's client script. No enforced coverage thresholds.

**Temporal**: `temporal-polyfill` imported at the top of both SvelteKit hooks files and the Table Worker entry, forced implementation on the server. TypeScript 6 with `lib.esnext.temporal`; Effect's type declarations need `lib: ESNext, DOM` and `skipLibCheck`.

**Local dev**: one multi-config `wrangler dev` for both Workers by default; `vite dev` for pure UI work with the WebSocket pointed at the running Table Worker. Never route a WebSocket upgrade through a SvelteKit endpoint.
