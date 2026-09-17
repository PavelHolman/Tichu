# Effect 4.0 RC: what it gives us and what it breaks

Research for ticket GitHub issue #5. Date of research: 2026-09-17.
Sources are primary only: the npm registry, the `effect@4.0.0-rc.115` tarball (source + bundled docs), the `Effect-TS/effect` GitHub repo, and effect.website (docs + first-party blog). Two empirical checks were run locally (a workerd smoke test and a Vitest 5 smoke test); their setup is described inline so they can be reproduced. Anything not backed by one of those is marked UNVERIFIED.

## Summary and recommendation

**There is no "Effect 4.0 RC4".** The `rc` dist-tag on npm is `effect@4.0.0-rc.115`; RC numbering continues the beta counter (beta.107 → rc.108 … rc.115), so "RC4" is a misremembering of the RC line. Stable `latest` is `effect@3.22.2` (2026-09-09). ([npm dist-tags](https://www.npmjs.com/package/effect?activeTab=versions), verified via `npm view effect dist-tags`.)

**Recommendation: adopt Effect 4.0 RC now, pinned to an exact rc version (`4.0.0-rc.115`), with lockstep pins for `@effect/vitest` and `@effect/platform-browser`.** Reasons:

1. The Effect team calls the RC a "statement of confidence", says interfaces are "presumed final", "no more broad breaking changes planned", and targets stable for "Q3/Q4 2026", i.e. within weeks to months of now. ([RC announcement, 2026-08-12](https://effect.website/blog/releases/effect/40-rc))
2. This is a greenfield project, so there is no v3 code to migrate; starting on v3 today means doing the v3→v4 migration later, against a 16,773-line rename map. ([migration/v3-to-v4.md](https://github.com/Effect-TS/effect/blob/main/migration/v3-to-v4.md))
3. Everything the project needs is in the v4 core: Schema (rewritten, in core), typed errors (`Schema.TaggedError` / `Data.TaggedError`), Layer/Context DI, Stream, Schedule, Config, and a native property-testing module with no fast-check dependency. The core package has zero runtime dependencies. ([effect@4.0.0-rc.115 package.json](https://registry.npmjs.org/effect/4.0.0-rc.115))
4. It runs on workerd: I bundled a worker using `Effect.gen`, `Schema.Class`, `Context.Service`, `Layer`, `Stream`, `Schedule` retry, and `Config` + `ConfigProvider.fromEnvRecord(env)` with esbuild (`--platform=browser`) and served it from `workerd@1.20260917.1` with no `nodejs_compat` flag; it returned the expected JSON. (Local check, see section 3.)
5. `@effect/vitest@4.0.0-rc.115` on Vitest 5.0.1 passes `it.effect` + `TestClock`, `layer()`, `it.prop`, and `it.effect.prop` in a local smoke test. (Local check, see section 4.)

The counter-argument is real but bounded: rc.113 (2026-09-10) shipped 234 changelog entries and 9 self-declared breaking changes despite the "no broad breaking changes" statement (see section 5). Mitigation is exact pinning plus a deliberate bump cadence, not v3. The one place to stay conservative is `effect/unstable/*` (may break in minors even after 4.0 stable); the project only needs `effect/unstable/arbitrary` (tests) and possibly `effect/unstable/reactivity` (client), both easy to isolate.

## 1. Release state, packages, timeline, migration guide

### Registry ground truth (2026-09-17)

| Package | `latest` | `rc` | `beta` | Notes |
|---|---|---|---|---|
| `effect` | 3.22.2 | 4.0.0-rc.115 | 4.0.0-beta.107 | RC versions: rc.108 (2026-08-12) … rc.115 (2026-09-11) |
| `@effect/vitest` | 0.30.0 | 4.0.0-rc.115 | 4.0.0-beta.107 | peers: `effect ^4.0.0-rc.115`, `vitest >=5.0.0 <6.0.0` |
| `@effect/platform-browser` | 0.77.1 | 4.0.0-rc.115 | 4.0.0-beta.107 | peer: `effect ^4.0.0-rc.115` |
| `@effect/platform` | 0.97.2 | none | none | v3-only; folded into `effect/unstable/*` in v4 |
| `@effect/sql` | 0.52.1 | none | none | v3-only; `effect/unstable/sql` in v4 |
| `@effect/schema` | 0.75.5 | none | none | v3-era; Schema is in `effect` core in v3.x and v4 |

Source: `npm view <pkg> dist-tags --json` and `npm view effect time --json` against registry.npmjs.org on 2026-09-17; registry JSON at https://registry.npmjs.org/effect/4.0.0-rc.115 and https://registry.npmjs.org/@effect/vitest/4.0.0-rc.115.

Publish cadence: 8 RC releases in 30 days (Aug 12, 14, 17, 20, 25, Sep 10, 11, 11). The v3 line is still maintained: `effect@3.22.2` on 2026-09-09 and `@effect/cli@0.77.2` on 2026-09-15 ([GitHub releases](https://github.com/Effect-TS/effect/releases)).

Unified versioning: in v4 all ecosystem packages share one version number and release together, so `effect`, `@effect/vitest`, `@effect/platform-browser` must be bumped in lockstep ([MIGRATION.md](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md), [beta announcement](https://effect.website/blog/releases/effect/40-beta)).

### Where v4 lives

- `Effect-TS/effect` default branch `main` is v4; v3 is on the `v3` branch. README: "Effect V4 is currently a release candidate." ([repo](https://github.com/Effect-TS/effect))
- `Effect-TS/effect-smol` (the former v4 incubator) is archived and read-only; its history was merged into the canonical repo. ([effect-smol README](https://github.com/Effect-TS/effect-smol), [July recap](https://effect.website/blog/effect-v4beta-july-recap))
- Docs: v4 docs at https://effect.website/docs/v4 (version switcher shows "v4 (rc)" / "v3"). Installation page: "Effect 4 is currently a release candidate, published under the `rc` tag on npm." ([installation](https://effect.website/docs/v4/getting-started/installation))
- API reference: https://effect.website/docs/v4/api/effect (linked from the package README).

### Timeline and what "RC" means (first-party statements)

- Beta announced 2026-02-18: "beta releases may include breaking changes"; "Once v4 does stabilize, it will be a long-term stable (LTS) release." Modules under `effect/unstable/*` "may receive breaking changes in minor releases. Modules outside `unstable/` follow strict semver." ([40-beta](https://effect.website/blog/releases/effect/40-beta))
- RC announced 2026-08-12: "This release candidate is a statement of confidence. It's not a claim that there is no more work to do." Interfaces "are now presumed final"; "no more broad breaking changes planned"; "We are targeting the stable release for Q3/Q4 2026." ([40-rc](https://effect.website/blog/releases/effect/40-rc))
- RC recap 2026-08-31: "No broad breaking changes are planned for the RC cycle, any change that does land will be narrow in scope, clearly communicated, and accompanied by a migration path." The RC is "an invitation to migrate real applications and validate against production workloads." ([august recap](https://effect.website/blog/effect-v4-rc-august-recap))
- There is no GitHub milestone, no pinned roadmap issue, and Discussions are disabled on the repo; the blog posts are the roadmap. A `4.0` label has 91 open items (all PRs in the sample), the `breaking` label has 0 open items. ([labels](https://github.com/Effect-TS/effect/labels), [open 4.0 items](https://github.com/Effect-TS/effect/issues?q=is%3Aopen+label%3A4.0))

### Migration guide

- Index: https://github.com/Effect-TS/effect/blob/main/MIGRATION.md (note: its header still says "Effect v4 is currently in beta", i.e. stale relative to the RC posts).
- Full rename map: https://github.com/Effect-TS/effect/blob/main/migration/v3-to-v4.md (16,773 lines; e.g. `effect/Either -> effect/Result`, `effect/JSONSchema -> effect/JsonSchema`, `@effect/platform/HttpApi* -> effect/unstable/httpapi/*`, `@effect/rpc/* -> effect/unstable/rpc/*`, `@effect/sql/* -> effect/unstable/sql/*`).
- Schema-specific guide: https://github.com/Effect-TS/effect/blob/main/packages/effect/SCHEMA.md (linked from the beta post) and `migration/schema.md`.
- Core sub-guides listed by MIGRATION.md: Services (`Context.Tag` → `Context.Service`), Cause flattened, `catch*` renamings, forking combinators renamed, Effect subtyping → Yieldable, fiber keep-alive, Layer memoization across `Effect.provide`, `FiberRef` → `Context.Reference`, `Runtime<R>` removed, Scope, Equality.
- No migration page exists on effect.website's v4 docs sidebar; the RC post links only to the GitHub file. (UNVERIFIED that none exists at an unlisted URL; `https://effect.website/docs/v4/migration` returns 404.)
- The August recap mentions an "automated v3→v4 migration skill available on skills.sh" for coding agents. ([august recap](https://effect.website/blog/effect-v4-rc-august-recap)) Not needed for a greenfield project.

## 2. API surface we will lean on, and what changed in v4

Evidence below comes from the shipped source in the `effect@4.0.0-rc.115` tarball (`src/*.ts`, which mirrors https://github.com/Effect-TS/effect/tree/main/packages/effect/src) and the bundled `ai-docs/` + `AGENTS.md` inside the same tarball. Export lists were produced with `grep -E "^export (const|function|class) NAME" src/Module.ts`.

### Requirements (README of effect@rc)

"TypeScript 5.9 or newer. TypeScript 7 is recommended"; "Node.js 18 or newer when running Effect on Node.js"; `strict: true` required. ([package README](https://registry.npmjs.org/effect/4.0.0-rc.115)) The docs installation page instead says "Node.js 22.18 or newer, Deno, and Bun are supported" ([installation](https://effect.website/docs/v4/getting-started/installation)); the two first-party statements disagree. Irrelevant for workerd/browser, relevant for the Vitest runner (Vitest 5 needs Node `^22.12.0 || ^24.0.0 || >=26.0.0` per the `@effect/vitest` README).

### Effect

Present in `src/Effect.ts`: `gen`, `fn`, `fnUntraced`, `succeed/fail/failCause/die/sync/suspend/promise/tryPromise`, `runSync/runPromise/runPromiseExit/runFork`, `catchTag/catchTags/catchCause/catchIf`, `catchReason/catchReasons` (new), `mapError/orDie/tapError/ignore/sandbox`, `retry/repeat/schedule`, `timeout/sleep/timed`, `scoped/scopedWith/scope/acquireRelease`, `forkScoped/forkIn`, `all/forEach`, `provide/provideService/provideServiceEffect/service`, `withSpan`, `exit/result/option`.
- `AGENTS.md` (bundled): prefer `Effect.gen` inline, `Effect.fn("name")` for traced reusable functions and `Effect.fnUntraced` for hot paths and library code; "Always return when raising an error" (`return yield* new MyError(...)`).
- Changed vs v3 (per MIGRATION.md index): `catch*` combinators renamed, forking combinators renamed, `Runtime<R>` removed, Effect subtyping replaced by a `Yieldable` protocol. Concretely in `src/Effect.ts`: there is no `Effect.fork` — the exports are `forkChild`, `forkIn`, `forkScoped`, `forkDetach`; there is no `catchAll` — `Effect.catch` (exported as `catch_ as catch`) handles all typed errors and `catchTag` accepts a tag or an array of tags; `Effect.either` is gone and `Effect.result` returns `Result`; `Effect.callback` replaces `Effect.async`; `Effect.fromNullishOr` replaces `fromNullable`. `Effect.retry` accepts a `Schedule`, a builder `($) => $(Schedule.spaced("1 seconds")).pipe(Schedule.while(...))`, or `{ while?, until?, times?, schedule? }`; defects and interruptions are never retried (`src/Effect.ts` ~7256–7400).
- `ManagedRuntime.make(layer, { memoMap? })` returns `{ runFork, runSync, runPromise, runPromiseExit, runCallback, dispose, disposeEffect, context }` and is the documented bridge for non-Effect hosts (`ai-docs/src/04_integration/10_managed-runtime.ts`) — the natural shape for a Durable Object holding one runtime per game.
- Observed: `Stream.runCollect` yields a plain array in v4 (v3 yielded a `Chunk`) in my Node run of the same program on both versions.
- Workers-relevant: issue #8038 "Effect.fn constructs an Error at every definition site, which costs most of a Cloudflare Workers startup budget" was closed 2026-09-07. ([#8038](https://github.com/Effect-TS/effect/issues/8038)) UNVERIFIED which rc contains the fix; rc.113+ is the safe assumption.

### Layer / Context / services

- `Context.ts` exports `Service`, `Reference`, `make`, `add`, `get`, `merge`, `empty`. There is no `Context.Tag`/`GenericTag` export. `Context.Service` JSDoc: "Call `Context.Service("Key")` for a function-style key, or use the two-stage form `Context.Service<Self, Shape>()("Key")` for class-style service" (`src/Context.ts` line ~201). Verified working: `class Deck extends Context.Service<Deck, { size: number }>()("Deck") {}` then `yield* Deck`.
- `Context.Reference<Service>(...)` replaces `FiberRef` (MIGRATION.md); e.g. `ConfigProvider.ConfigProvider` is a `Context.Reference` (`src/ConfigProvider.ts` line 342).
- `Layer.ts` exports `effect`, `succeed`, `sync`, `effectDiscard`, `effectContext`, `provide`, `provideMerge`, `merge`, `mergeAll`, `unwrap`, `launch`, `build`, `buildWithScope`, `fresh`, `empty`. `Layer.succeed(Deck)({ size: 56 })` is the curried form (verified). Also `LayerMap.ts`, `LayerRef.ts`, `ManagedRuntime.ts` exist for multi-instance layers and long-lived runtimes (`ai-docs/src/04_integration/10_managed-runtime.ts`).
- `Layer.mock(Service, partialImpl)` creates partial service mocks whose unimplemented effectful members fail with a defect (`src/Layer.ts` ~4035) — useful for rules-core tests.
- Changed vs v3: layer memoization across `Effect.provide` changed (MIGRATION.md "Layer memoization"); `LayerMap.contextEffectOption` / `RcMap.getOption` added in rc.112.

### Typed errors and Cause

- Two error-class constructors coexist: `Schema.TaggedError<Self>()("Tag", { fields })` (schema-backed, yieldable, serialisable; used throughout `ai-docs`) and `Data.TaggedError("Tag")<{ fields }>` (`src/Data.ts` line 1111, returns `Cause.YieldableError & { _tag }`). Effect's own code uses `Data.TaggedError` (e.g. `ConfigProvider.SourceError`). For a rules core whose errors cross the DO↔browser wire, `Schema.TaggedError` is the right default.
- New "reason" pattern: a parent tagged error with a `reason: Schema.Union([...])` field, handled with `Effect.catchReason("Parent", "ReasonTag", handler, orElse?)`, `Effect.catchReasons("Parent", { ReasonTag: handler })`, or lifted with `Effect.unwrapReason("Parent")` then `Effect.catchTags` (`ai-docs/src/01_effect/04_errors/20_reason-errors.ts`).
- `Cause.ts` exports `fail`, `die`, `interrupt`, `squash`, `pretty`, `prettyErrors`, `findError`, `isCause`, and built-in errors `NoSuchElementError`, `TimeoutError`, `IllegalArgumentError`. Shape in `src/Cause.ts`: `Cause<E>` has `reasons: Array<Reason<E>>` with `Reason<E> = Fail<E> | Die | Interrupt` (`Fail.error`, `Die.defect`, `Interrupt.fiberId`), plus `hasFails/hasDies/hasInterrupts`, `findError/findDefect/findInterrupt`, `Cause.fromReasons/combine`. That is the "flattened" Cause MIGRATION.md refers to: a flat array of reasons instead of v3's Sequential/Parallel tree. `Cause.Done<A>` is the end-of-stream/queue signal.
- `Result.ts` (replaces `Either`): `succeed`, `fail`, `isSuccess`, `isFailure`, `match`, `map`, `mapError`, `flatMap`, `orElse`, `getOrElse`, `getOrThrow`, `fromOption`, `all`. Rename map entry: `effect/Either -> effect/Result`.

### Schema (in core, rewritten)

- Modules: `Schema`, `SchemaAST`, `SchemaGetter`, `SchemaIssue`, `SchemaParser`, `SchemaTransformation`, `SchemaRepresentation`, `JsonSchema`, `StandardSchema` (public since rc.112), `Optic`. Separate v3 package `@effect/schema` is not part of v4; the schema migration guide is `packages/effect/SCHEMA.md`.
- Constructors present: `Struct`, `Class`, `TaggedClass`, `TaggedError`, `TaggedUnion` (with `matchOrElse` since rc.112), `Union` (takes an array: `Schema.Union([A, B])`), `TaggedStruct`, `tag`, `Literal`, `Literals`, `String`, `Number`, `Int`, `Uint`, `Boolean`, `NonEmptyArray`, `Tuple`, `Record`, `Option`, `Result`, `Date`, `DateTimeUtc`, `Duration`, `Redacted`, `TemplateLiteral`, `NullOr`, `UndefinedOr`, `optional`, `optionalKey`, `mutable`, `brand`, `suspend`, `instanceOf`, `declare`, `Opaque`.
- Decoding names: `decodeUnknownEffect`, `decodeUnknownSync`, `decodeUnknownPromise`, `decodeUnknownResult`, `decodeUnknownOption`, `decodeEffect`, `decodeSync`, `encodeEffect`, `encodeSync`, `encodeUnknownEffect`, `is`, `asserts`. v3's `Schema.decodeUnknown` (Effect-returning) is now `decodeUnknownEffect` (verified: v3 program used `decodeUnknown`, v4 program needed `decodeUnknownEffect`).
- Checks are functions applied via `.check(...)`: `Schema.Int.check(Schema.isBetween({ minimum: 2, maximum: 14 }))`; `isBetween` takes an options object (`src/Schema.ts` line 7458). Also `isGreaterThan`, `isMinLength`, `isMaxLength`, `isPattern`, `isNonEmpty`, `isUUID`, `isTrimmed`, `isFinite`.
- Transformations: `decodeTo`, `encodeTo`, `SchemaGetter.transformEffect` (renamed from `transformOrFail` in rc.113); no top-level `Schema.transform`/`transformOrFail` export.
- Type extraction: `typeof User["Type"]`, `typeof User["Encoded"]` (`ai-docs/src/01_effect/02_schema/10_schema-basics.ts`).
- rc.113 changelog: "Align Schema construction and parsing semantics", JSON Schema `additionalProperties` → `onExcessProperty`, `SchemaError` moved into `Schema` (rc.108), synchronous decode/encode performance work (rc.112). ([CHANGELOG.md](https://github.com/Effect-TS/effect/blob/main/packages/effect/CHANGELOG.md))

### Stream / Sink / Channel / PubSub / Queue

- `Stream.ts` exports `fromIterable`, `fromArray`, `fromEffect`, `fromQueue`, `fromPubSub`, `fromSchedule`, `fromReadableStream`, `callback`, `make`, `succeed`, `fail`, `empty`; consumers `runCollect`, `runForEach`, `runDrain`, `runFold`, `runHead`, `run`, `toPull`, `toQueue`, `toPubSub`, `toReadableStream`; operators `map`, `mapEffect`, `filter`, `take`, `takeUntil`, `takeWhile`, `tap`, `scan`, `merge`, `mergeAll`, `zip`, `zipLatest`, `flatMap`, `concat`, `buffer`, `broadcast`, `share`, `repeat`, `retry`, `schedule`, `timeout`, `interruptWhen`, `encodeText`, `decodeText`. `Sink.ts`, `Channel.ts`, `Pull.ts`, `PubSub.ts`, `Queue.ts`, `SubscriptionRef.ts`, `Take.ts` exist. Examples in `ai-docs/src/03_stream/*.ts`.
- Changed vs v3: `Stream.async` is absent; `Stream.callback((queue) => Effect<_, E, R | Scope>)` with `Queue.offerUnsafe` is the documented push-to-stream bridge (`ai-docs/src/03_stream/10_creating-streams.ts`); `runCollect` returns an array (observed); `Channel.runDone` removed in rc.113 (use `runDrain`). `Queue<A, E>` carries an error type and ends with `Queue.end` (`Cause.Done`); `PubSub.bounded({ capacity, replay })` supports replay; `SubscriptionRef.changes(ref)` yields the current value then every update — the natural bridge from game state to a Svelte 5 store (design suggestion, not from the docs). Also present: `Stream.fromEventListener`, `fromAsyncIterable`, `toAsyncIterable`, `debounce`, `throttle`, `switchMap`.

### Scope

`Scope.ts` exports `make`, `makeUnsafe`, `close`, `addFinalizer`, `fork`, `provide`, `use`. Resource pattern: `Effect.acquireRelease(acquire, release)` inside `Effect.scoped`, or `Layer.effect`/`Layer.scoped`-style layers whose finalisers run on layer teardown (`ai-docs/src/01_effect/05_resources/*.ts`). `@effect/vitest` gives each test its own Scope ("Do not wrap the test body in `Effect.scoped`"). MIGRATION.md lists a "Scope" sub-guide for behaviour changes; details UNVERIFIED.

### Config / ConfigProvider

- A `Config<T>` **is** an `Effect<T, ConfigError>` (`src/Config.ts` line 108), so `yield* Config.String("GAME_NAME")` works directly.
- Constructors are PascalCase as of rc.113: `Config.String`, `NonEmptyString`, `Number`, `Finite`, `Int`, `Boolean`, `Literal`, `Literals`, `Array`, `Record`, `Duration`, `ByteSize`, `Port`, `LogLevel`, `Redacted`, `URL`, `Date`, `schema(codec)`, plus `map`, `mapEffect` (was `mapOrFail`), `orElse`, `withDefault`, `option`, `all`, `nested`, `unwrap`. Lowercase `Config.string` does not exist (my first worker attempt failed on it).
- Providers: `ConfigProvider.fromEnvRecord(env)`, `fromUnknown(json)`, `fromEnv()`, `fromDotEnv`, `fromDir`, `make(get)`, `orElse`, `nested`, `constantCase`, `layer`, `layerAdd`. The default provider merges `globalThis.process?.env` and `import.meta.env` (`dist/ConfigProvider.js` lines 658–708), so on workerd you must provide `ConfigProvider.fromEnvRecord(env)` from the fetch handler / DO constructor. Verified in the workerd run.

### Schedule / retry

`Schedule.ts` exports `exponential`, `spaced`, `fixed`, `recurs`, `jittered`, `fibonacci`, `forever`, `windowed`, `cron`, `during`, `addDelay`, `modifyDelay`, `passthrough`, `map`, `CurrentMetadata`; used via `Effect.retry(schedule)`, `Effect.repeat`, `Effect.schedule`, `Stream.retry/schedule`. Examples in `ai-docs/src/06_schedule/10_schedules.ts`. The July recap describes a "Schedule overhaul" for v4 ([july recap](https://effect.website/blog/effect-v4beta-july-recap)); rc.110 added "narrowing schedule input and output types with type guard predicates". Composition differs from v3: there is no `both/either/intersect/union/andThen/compose`; instead `Schedule.max([...])` (continue while all continue, slowest delay) and `Schedule.min([...])` (continue while any continues, fastest delay), plus `Schedule.while(({ input, attempt, elapsed }) => boolean)`, `Schedule.jittered`, `Schedule.setInputType<E>()`, `Schedule.tap`, `Schedule.concat`. Documented production pattern (`ai-docs/src/06_schedule/10_schedules.ts`): `Schedule.min([Schedule.exponential("250 millis"), Schedule.spaced("10 seconds")]).pipe(Schedule.jittered, Schedule.setInputType<HttpError>(), Schedule.while(({ input }) => input.retryable))`. Each step sees `InputMetadata { input, attempt, start, now, elapsed, elapsedSincePrevious }` (`src/Schedule.ts` 53–100).

### `effect/unstable/*`

Export map of `effect@4.0.0-rc.115`: `./unstable/{ai, arbitrary, cli, cluster, devtools, encoding, eventlog, http, httpapi, net, observability, persistence, process, reactivity, rpc, schema, socket, sql, workflow, workers}`. Policy: may break in minor releases even after 4.0 stable ([40-beta](https://effect.website/blog/releases/effect/40-beta)). `unstable/reactivity` contains `Atom`, `AtomRef`, `AtomRegistry`, `AsyncResult`, `Hydration`, `Reactivity` (the former `@effect/atom-*` line) — a candidate bridge to Svelte 5 runes, but unstable.

## 3. Runtime compatibility: workerd and browsers

### First-party statements

- "Effect now has first-class support for Deno alongside Node.js, Bun, and the browser." ([july recap](https://effect.website/blog/effect-v4beta-july-recap))
- Docs installation page lists Node, Bun, Deno and a Vite+React browser setup; it does not mention Cloudflare Workers. ([installation](https://effect.website/docs/v4/getting-started/installation))
- No Cloudflare page mentions Effect (site-restricted search only; UNVERIFIED negative).
- No `@effect/platform-cloudflare` package is published. It is in progress: PR #7322 "Cluster sharding on Cloudflare Durable Objects" adds `@effect/platform-cloudflare` with SQLite-backed DO classes (`ClusterEntity`, `ClusterWorkflow`, `ClusterDurableQueue`, `ClusterSingleton`); branch last touched 2026-09-07. ([#7322](https://github.com/Effect-TS/effect/pull/7322)) Cloudflare packages that do exist at rc.115: `@effect/sql-d1` and `@effect/sql-sqlite-do`. ([sql-d1](https://www.npmjs.com/package/@effect/sql-d1), [sql-sqlite-do](https://www.npmjs.com/package/@effect/sql-sqlite-do))

### Package-level evidence (tarball inspection)

- `effect@4.0.0-rc.115` has no `dependencies`, `peerDependencies`, or `engines`; `"type": "module"`, `"sideEffects": []` (tree-shakeable). ([registry JSON](https://registry.npmjs.org/effect/4.0.0-rc.115))
- The only `node:` imports in the whole `dist/` are in `dist/testing/TestSchema.js` (`node:assert`, `node:util`), a test helper. The `unstable/` folders (cli, process, net, sql, …) reference `node:` only where expected. Core modules instead feature-detect: `globalThis.process?.env` (ConfigProvider), `globalThis.process?.hrtime` (Clock), `process?.stdout` (Console) — all guarded (`dist/internal/effect.js` lines 2848–3186).
- `@effect/platform-browser@4.0.0-rc.115` provides `BrowserHttpClient`, `BrowserKeyValueStore`, `BrowserPersistence`, `BrowserRuntime.runMain`, `BrowserSocket`, `BrowserStream`, `BrowserWorker`/`WorkerRunner`, `Clipboard`, `Geolocation`, `IndexedDb*`, `Permissions`, `BrowserCrypto`. ([registry](https://registry.npmjs.org/@effect/platform-browser/4.0.0-rc.115))

### Local workerd smoke test (passed)

Setup: `npm i effect@rc esbuild workerd@latest` (workerd `1.20260917.1`); a worker module using `Effect.gen`, `Schema.Class`, `Schema.decodeUnknownEffect`, `Context.Service`, `Layer.succeed`, `Stream.fromIterable → runCollect`, `Effect.retry(Schedule.recurs(1))`, `Config.String("GAME_NAME")` with `ConfigProvider.fromEnvRecord(env)`; bundled with `esbuild --bundle --format=esm --platform=browser`; run with `workerd serve` from a capnp config with `compatibilityDate = "2026-09-01"`, a text binding, and **no** `nodejs_compat` flag. `curl` returned `{"rank":7,"deck":56,"xs":[1,2,3],"name":"tichu"}`. Not tested: Durable Object classes, WebSockets, alarms, and `@effect/sql-sqlite-do` (which has open workerd transaction issues #6006/#5987, see Risks).

### Bundle size (local, esbuild `--minify --platform=browser`)

Same minimal program (Effect.gen + Schema.Class + Schedule retry + Stream.runCollect):

| | minified | gzipped |
|---|---|---|
| `effect@4.0.0-rc.115` | 362 KB | 116 KB |
| `effect@3.22.2` | 529 KB | 166 KB |
| worker above (adds Context/Layer/Config) | — | 124 KB |

First-party claims are much smaller: "A minimal program using Effect, Stream, and Schema drops from roughly 70 kB in v3 to about 20 kB in v4" ([40-beta](https://effect.website/blog/releases/effect/40-beta)); "a minimal Effect program bundles to ~6.3 KB (minified + gzipped). With Schema, ~15 KB" ([MIGRATION.md](https://github.com/Effect-TS/effect/blob/main/MIGRATION.md)). My numbers are higher because the probe pulls in Stream, Schedule and `Effect.runPromise` from the barrel `effect` import; the ratio (about 30% smaller than v3) is consistent with the claim. Treat 100–130 KB gz as the realistic floor for a client that uses Stream + Schema + Layer; well under Workers' script limits. UNVERIFIED: whether deep imports (`effect/Effect`) shrink this further — the export map allows `./*` so it is possible.

## 4. @effect/vitest and property testing

- `@effect/vitest@4.0.0-rc.115`: peers `effect ^4.0.0-rc.115`, `vitest >=5.0.0 <6.0.0`, no runtime dependencies. README (in the tarball; same as [packages/vitest/README.md on main](https://github.com/Effect-TS/effect/blob/main/packages/vitest/README.md)): `it.effect` (scoped test with `TestClock`/`TestConsole`), `it.live`, `it.layer` / `layer(L, { concurrent?, memoMap?, timeout?, excludeTestServices? })(name, (it) => …)`, `it.prop` ("property tests using Effect `Schema` and `Arbitrary` values"), `it.flakyTest`, `it.effect.skip/only/fails`. There is no `it.scoped` in v4; each `it.effect`/`it.live` already opens and closes a Scope. Log output is suppressed in `it.effect` unless a logger layer is provided. Requires Vitest 5; README documents Vitest 4→5 removals (`sequential` → `{ concurrent: false }`, `bench` fixture, `Assertion<void, T>`).
- `TestClock` is imported from `effect/testing` (`import { TestClock } from "effect/testing"`), not from `@effect/vitest`.
- Local smoke test (passed, Node 26.5.0, Vitest 5.0.1): `it.effect` + `TestClock.adjust("1000 millis")` → `Clock.currentTimeMillis === 1000`; `layer(DeckLive)("with deck", it => it.effect(...))` reading a `Context.Service`; `it.prop("...", [CardSchema], ([c]) => …)`; `it.effect.prop("...", { c: CardSchema }, ({ c }) => Effect.sync(...))`. 4/4 passed.
- Property testing: `effect/unstable/arbitrary` (`Arbitrary.schema(S, options?)`, `Constant`, `map`, `filter`, `filterMap`, `flatMap`, `all`, `sampleEffect`, `checkEffect`, `formatCheckFailure`) is a native implementation: `src/unstable/arbitrary/Arbitrary.ts` imports only internal modules, and `dist/internal/arbitrary/runner.js` mentions fast-check solely in MIT attribution comments for borrowed strategies. rc.113 removed "the fast-check bridge from the `effect` package, including `Schema.toArbitrary`" and `effect/testing/FastCheck`. ([CHANGELOG.md](https://github.com/Effect-TS/effect/blob/main/packages/effect/CHANGELOG.md), [august recap](https://effect.website/blog/effect-v4-rc-august-recap)) Consequence: no fast-check dependency, but the arbitrary module is under `unstable/` and its API may still move (rc.114 already renamed `Schema.Annotations.ToArbitrary.Constraint` → `FilterConstraint`).

## 5. RC risk assessment

### Churn during the RC phase

From `packages/effect/CHANGELOG.md` on `main` (changeset headings; no version has a "Major Changes" section, so breaking changes are identified by prose):

| Version | Date | Entries | Self-declared breaking |
|---|---|---|---|
| rc.108 | 2026-08-12 | 13 | 0 (removed standalone `SchemaError` module) |
| rc.109 | 2026-08-14 | 10 | 0 |
| rc.110 | 2026-08-17 | 29 | 0 (CLI boolean flags required; Graph negative-cycle throws) |
| rc.111 | 2026-08-20 | 32 | 0 |
| rc.112 | 2026-08-25 | 28 | 0 in headings; Pool interface change (#7402), CLI prompt theme (#7382) |
| rc.113 | 2026-09-10 | 234 | 9 |
| rc.114 | 2026-09-11 | 8 | 0 (rename in ToArbitrary annotations) |
| rc.115 | 2026-09-11 | 3 | 0 |

rc.113's nine self-declared breaking entries: Config constructors → PascalCase and `mapOrFail` → `mapEffect`; CLI constructors → PascalCase; `Fiber` context-derived fields moved under `fiber.cache`; native `pg` client replacing `PgClient.fromPool`; tool-result serialisation; Socket redesigned around a scoped pull-based reader; "Align Schema construction and parsing semantics"; JSON Schema `additionalProperties` → `onExcessProperty`; template-literal validation split. Also removed in rc.113 without the word "breaking": fast-check bridge, `mime` dependency, MessagePack/RPC serialisation APIs, `Channel.runDone`. ([CHANGELOG.md](https://github.com/Effect-TS/effect/blob/main/packages/effect/CHANGELOG.md), [rc.113 release](https://github.com/Effect-TS/effect/releases/tag/effect%404.0.0-rc.113))

Of those, the ones that would have touched this project: Config PascalCase (mechanical), Schema parsing semantics (needs a re-run of the test suite), arbitrary API (tests only). Nothing in Effect/Layer/Context/Stream/Scope/Schedule core changed shape during the RC.

### Pin v3 instead?

Arguments for v3: stable semver, `effect@3.22.2` still receiving patches, mature docs, no RC surprises. Arguments against, for this project: the v3→v4 migration is large (rename map of 16k lines; Context.Tag→Service, Either→Result, Schema rewrite, `catch*` renames), so code written on v3 today is code to be rewritten; v3 will become the maintenance branch once 4.0 ships (planned Q3/Q4 2026); v4 bundles are about 30% smaller in my measurement and much smaller by first-party numbers; and v4 core has zero dependencies. Since the game has no existing v3 code, v3 buys stability for a few months at the cost of a guaranteed migration.

**Decision: adopt v4 RC, exact-pin `4.0.0-rc.115` (no caret) across `effect`, `@effect/vitest`, `@effect/platform-browser`; bump deliberately, reading the changelog each time; keep `effect/unstable/*` usage behind small adapters.**

## Risks

1. **Further narrow breaking changes before 4.0.0** — the team reserves the right; rc.113 shows they exercise it. Mitigation: exact pins, `npm view effect@rc version` in a weekly check, tests on every bump. ([40-rc](https://effect.website/blog/releases/effect/40-rc))
2. **`unstable/*` may break in minors even after stable** — applies to `unstable/arbitrary` (tests) and `unstable/reactivity` (if used for Svelte bridging). Keep them at the edges. ([40-beta](https://effect.website/blog/releases/effect/40-beta))
3. **No first-party Cloudflare/workerd support statement for v4** and no Cloudflare platform package yet (#7322 open). The core runs on workerd (verified locally) but DO-specific integration (SQLite storage via `@effect/sql-sqlite-do`, WebSocket hibernation, alarms) is on us. Open issues: #6006 and #5987 (`sql-sqlite-do` `withTransaction` incompatible with DO SQLite transaction model), #6319 (`HttpApp.toWebHandlerLayerWith` hang on aborted first request on workerd, labelled 3.0), #8205 (FetchHttpClient response stream drops workerd known-length). ([#6006](https://github.com/Effect-TS/effect/issues/6006), [#5987](https://github.com/Effect-TS/effect/issues/5987), [#6319](https://github.com/Effect-TS/effect/issues/6319), [#8205](https://github.com/Effect-TS/effect/issues/8205))
4. **Startup cost on Workers** — #8038 (`Effect.fn` allocating an `Error` per definition site, "most of a Cloudflare Workers startup budget") is closed as of 2026-09-07; prefer `Effect.fnUntraced` in the rules core hot paths regardless, per `AGENTS.md`. ([#8038](https://github.com/Effect-TS/effect/issues/8038))
5. **Docs lag** — no v4 migration page on the website, MIGRATION.md header still says "beta", README vs docs disagree on Node minimum. Rely on the tarball's `ai-docs/` and `AGENTS.md` and on the source; both ship in the package.
6. **Tooling coupling** — `@effect/vitest@rc` requires Vitest 5 (Node ≥22.12) and drops Vitest 4 helpers; TypeScript ≥5.9 required, TS 7 recommended. Check the SvelteKit/Vite toolchain supports Vitest 5 before committing. (UNVERIFIED for the Svelte side; outside this ticket.)
7. **Bundle size for the browser client** — realistic 100–130 KB gzipped when Stream + Schema + Layer are all used from the barrel import (local measurement), versus the 15–20 KB first-party figure for a minimal program. Acceptable for a game client, but measure once the client's real import set exists and try deep imports.
8. **Package matrix** — `@effect/platform`, `@effect/sql`, `@effect/schema` have no 4.0 builds; anything that depends on them is v3-only. Do not mix v3-era `@effect/*` packages with `effect@4`.

## Method notes

- Registry queries: `npm view effect versions/dist-tags/time --json`, same for `@effect/vitest`, `@effect/platform`, `@effect/sql`, `@effect/platform-browser`, `@effect/schema` (2026-09-17).
- Tarballs unpacked with `npm pack effect@rc @effect/vitest@rc @effect/platform-browser@rc`; the package ships `src/`, `dist/`, `ai-docs/`, `AGENTS.md`, `CLAUDE.md`, `README.md`.
- Web: effect.website blog posts and docs pages, GitHub releases/changelog/issues/PRs as linked inline. GitHub Discussions are disabled and there are no milestones, so no roadmap beyond the blog exists.
- Section 2 combines direct greps of `src/*.ts` with a sub-investigation that read the bundled `ai-docs/` and JSDoc; line numbers refer to the rc.115 tarball and match `packages/effect/src` on `main` at the rc.115 tag.
