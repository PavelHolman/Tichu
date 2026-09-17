# 02 What does Effect 4.0 RC4 give us and what does it break?

Type: research
Status: resolved
Blocked by: 
Map: ../map.md

## Question

From Effect's primary sources (repo, changelogs, docs), establish: the current state of Effect 4.0 RC4 (published packages, stability, migration notes from v3), the API surface we will lean on (Effect, Layer, Schema, Stream, Scope, Config, Cause and typed errors), whether it runs on workerd and in browsers, and the state of `@effect/vitest` for 4.0. Flag any RC risk that would argue for pinning v3 instead. Deliverable: `.scratch/tichu/research/effect-4-rc.md`.

## Answer

**Adopt Effect v4 RC now, exact-pinned.** Findings with citations: [research/effect-4-rc.md](../research/effect-4-rc.md).

- There is no "RC4". The npm `rc` tag is `effect@4.0.0-rc.115` (RC numbering continued from beta.107); stable `latest` is still 3.22.2. Pin `effect`, `@effect/vitest`, and `@effect/platform-browser` to the same exact RC version; unified versioning means lockstep bumps.
- Timeline from Effect's own posts: RC declared 2026-08-12, interfaces "presumed final", stable targeted Q3/Q4 2026. `effect-smol` is archived; v4 is `main`.
- Migration guide: `MIGRATION.md` in the Effect repo plus a rename map and a Schema guide. No website page.
- v4 folds platform, rpc, sql and friends into `effect/unstable/*` (may break in minors even after stable). Core has zero dependencies and tree-shakes.
- API shifts to design against: `Context.Service` replaces `Tag`; `Effect.catch` and `forkChild`; `Result` replaces `Either`; flat `Cause.reasons`; PascalCase `Config.String`; `Schema.decodeUnknownEffect`; `Schedule.max/min` and `Schedule.while`.
- Runtime: a bundled v4 program ran on `workerd@1.20260917.1` **without** `nodejs_compat`; only the test-schema module imports `node:`. Roughly 116 to 124 KB gzipped for a core program.
- Testing: `@effect/vitest@rc` needs **Vitest 5** (Node 22.12 or newer). `it.effect`, `TestClock`, `layer()`, `it.prop` verified locally. Property testing uses the built-in `effect/unstable/arbitrary`; fast-check was removed in rc.113.
- Risk: rc.113 (2026-09-10) shipped nine self-declared breaking changes (Config rename, Schema parsing, Socket redesign, fast-check and msgpack removal). No Cloudflare platform package yet (PR #7322 open); `sql-sqlite-do` has open DO-transaction issues, so persistence (08) should consider raw DO SQLite over the Effect SQL adapter.

Consequences: repo layout (06) pins exact RC versions and Vitest 5; rules engine (05) uses the built-in arbitrary module; persistence (08) weighs raw SQLite against `sql-sqlite-do`.
