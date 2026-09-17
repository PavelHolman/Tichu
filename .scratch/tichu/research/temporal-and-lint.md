# Temporal-only time and no-throw enforcement with oxlint/oxfmt; git-hook wiring under Bun

Resolves: `../issues/03-temporal-and-lint.md`
Researched: 2026-09-17, against primary sources only (docs, release notes, GitHub sources/PRs, npm registry, MDN compat data). Every claim carries its source URL. Anything not confirmed from a primary source is marked **UNVERIFIED**.

Package versions below were read from the npm registry on 2026-09-17 (`npm view <pkg> version time.modified`).

---

## Summary and recommendations

| Question | Answer |
| --- | --- |
| Is Temporal native where we run? | **Bun 1.4: yes (default on). Node 26: yes; Node 24 LTS: no. Chrome 144+/Firefox 139+: yes. Safari stable: no (Technology Preview only). Cloudflare Workers/workerd: NO — briefly shipped broken in July 2026, reverted 2026-08-04, no compat flag merged yet.** |
| Polyfill | **`temporal-polyfill` 1.0.5 (FullCalendar)**: 19.4 kB min+gzip, tracks the September 2026 spec, MIT, `import 'temporal-polyfill/global'` uses native when present. Avoid `@js-temporal/polyfill` (0.5.1, March 2025 spec snapshot, 52 kB, no global install, self-described pre-production). |
| Where to import it | Top of `src/hooks.server.ts` **and** `src/hooks.client.ts` (SvelteKit runs both at app start). In Workers, prefer the forced implementation (`temporal-polyfill/implementation`) or a guarded `installImplementation()` so a half-enabled native `Temporal` in workerd cannot hijack the clock (this exact failure happened in July 2026). |
| TypeScript types | TypeScript ≥ 6.0 ships `lib.esnext.temporal`; set `"lib": ["esnext"]`. Current TS is 7.0.2. |
| Effect DateTime | Effect's `DateTime`/`Clock`/`Schedule` use `Date`/`Date.now()` internally and expose `Date` in their API (`toDate`, `nowAsDate`, `unsafeFromDate`). No `toTemporal`/`fromTemporal`. Effect v4 (rc) accepts Temporal-shaped inputs (`{ epochMilliseconds }`). Use `DateTime` freely inside Effect code; bridge with `Temporal.Instant.fromEpochMilliseconds(DateTime.toEpochMillis(dt))`; keep the `Date` ban targeted at app code. |
| oxlint | 1.83.0 (stable 1.x; no 2.x). Built-in `eslint/no-restricted-globals` (with `checkGlobalObject`) bans the `Date` value; built-in `typescript/no-restricted-types` bans the `Date` type. **No native `no-restricted-syntax`** and no `functional/no-throw-statements`; `typescript/only-throw-error` only forbids non-Error throws. The `throw` ban needs the **JS plugin API (alpha since 2026-03-11)**: either the oxc team's own `oxlint-plugin-eslint` package (ESLint's built-in rules incl. `no-restricted-syntax` with `ThrowStatement`) or a 10-line custom rule. Configs below. |
| oxfmt | 0.68.0, **beta** (Feb 2026), 100 % Prettier JS/TS conformance, defaults = Prettier except `printWidth: 100` and `sortPackageJson: true`. `.svelte` formatting exists (added 0.49.0, "Experimental", via a bundled `prettier-plugin-svelte`, needs `"svelte": true` + the `svelte` package). Alternative: Prettier 3.9.7 + `prettier-plugin-svelte` 4.1.1 scoped to `*.svelte`. |
| Hooks | husky 9.1.7 (`bunx husky init`; Bun runs the root `prepare` script), lint-staged 17.5.1 (needs Node ≥ 22.22.1 — it runs under Node via `bunx`), commitlint 21.2.2 + `@commitlint/config-conventional` (Node ≥ 22.12). Lighter alternative: a 15-line shell regex in `.husky/commit-msg`, or lefthook 2.1.14 replacing husky+lint-staged. |

Recommended stack: `temporal-polyfill` + oxlint (built-ins + one tiny JS plugin) + oxfmt (with `svelte: true`, or Prettier for `.svelte` only if the experimental path misbehaves) + husky + lint-staged + commitlint. Snippets in the sections below are copy-pasteable.

---

## 1. Temporal: native support and polyfill

### 1.1 TC39 status

- The proposal README states: "This proposal is currently Stage 4" and it "will be merged into the ECMA-262 (PR #3759) and ECMA-402 (PR #1044) standards". Implementation status listed: Firefox 139 (May 2025), Chrome 144 (Jan 2026), Node.js 26 (May 2026), Safari "in development". — https://github.com/tc39/proposal-temporal
- ECMA-262 PR #3759 was closed unmerged on 2026-09-01 ("getting too big… Review continues in #3966"); PR #3966 "Temporal stage 4, round 2" is still open. So Temporal is Stage 4 but **not yet merged into the ECMA-262 text**; any "ES2026" label is **UNVERIFIED**. — https://github.com/tc39/ecma262/pull/3966
- MDN: Baseline "Limited availability" — "does not work in some of the most widely-used browsers". — https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal

### 1.2 Runtime matrix (MDN browser-compat-data, `javascript/builtins/Temporal.json`, main)

Source: https://raw.githubusercontent.com/mdn/browser-compat-data/main/javascript/builtins/Temporal.json — status `experimental: false, standard_track: true`.

| Runtime | Native Temporal | Evidence |
| --- | --- | --- |
| **Bun 1.4.0** | **Yes, on by default** | BCD `bun: 1.4.0`. PR oven-sh/bun#32978 "Enable Temporal by default", merged 2026-08-05: sets `JSC::Options::useTemporal() = true`, exposes the `Temporal` global and `Date.prototype.toTemporalInstant`; "`BUN_JSC_useTemporal=0` still turns it back off". Issue #15853 closed the same day. Bun 1.4 blog (2026-08-20) lists it under "Shipped in Bun v1.4.0". Upstream: WebKit bug 318885 "[JSC] Enable Temporal object by default" fixed 2026-07-08. — https://github.com/oven-sh/bun/pull/32978 , https://github.com/oven-sh/bun/issues/15853 , https://bun.com/blog/bun-v1.4 , https://bugs.webkit.org/show_bug.cgi?id=318885 |
| **Cloudflare Workers / workerd** | **No** | `compatibility-date.capnp` on `main` has **no** `temporal` flag (searched raw file 2026-09-17); the compat-flags docs page has no Temporal entry. Issue cloudflare/workerd#6907 (2026-07-31): the deployed runtime "exposes native Temporal with a clock stuck at epoch 0" (V8 15.x built with Temporal but workerd's `TemporalHostSystemUTCEpochNanosecondsCallback` not wired); Cloudflare replied "We're reverting the feature… We do plan to enable native Temporal, but I don't have a timeline"; closed 2026-08-04 after revert. PR #6943 "Temporal use same time as Date.now() + compat flag" proposes `temporal @186 :Bool $compatEnableFlag("temporal") $compatDisableFlag("no_temporal") $compatEnableDate("2026-09-08")` but is **open, unmerged** — that date is not authoritative (**UNVERIFIED** until merged). workerd's `jsg/resource.c++` still says "We don't enable the Temporal API yet". — https://raw.githubusercontent.com/cloudflare/workerd/main/src/workerd/io/compatibility-date.capnp , https://developers.cloudflare.com/workers/configuration/compatibility-flags/ , https://github.com/cloudflare/workerd/issues/6907 , https://github.com/cloudflare/workerd/pull/6943 , https://github.com/cloudflare/workerd/discussions/6716 |
| **Node.js** | 26: yes; 24 LTS: no | Node 26.0.0 (2026-05-05): "The Temporal API is now enabled by default in Node.js 26" (V8 14.6.202.33); "will enter long-term support (LTS) in October". PR nodejs/node#61806 says it was previously behind `--harmony-temporal`, is semver-major and labelled `dont-land-on-v24.x`. Active LTS as of Sept 2026 is **v24 "Krypton"**. — https://nodejs.org/en/blog/release/v26.0.0 , https://github.com/nodejs/node/pull/61806 , https://nodejs.org/en/about/previous-releases |
| **Chrome / Edge** | 144+ | BCD `chrome: 144` (Edge mirrors). |
| **Firefox** | 139+ | BCD `firefox: 139`. |
| **Safari** | **No (stable)** | BCD `safari: "preview"`, `safari_ios: false`. Safari Technology Preview 249 (2026-07-29): "Added support for the `Temporal` object." Safari 27.0 stable notes (2026-09-14) only mention a `Temporal.Instant` bug fix; whether stable Safari 27 exposes `Temporal` is **UNVERIFIED/contradictory** — assume not. — https://webkit.org/blog/18182/release-notes-for-safari-technology-preview-249/ , https://developer.apple.com/documentation/safari-release-notes/safari-27-release-notes |
| Deno | 2.7+ | BCD `deno: 2.7`. |

Conclusion: production needs a polyfill for **Workers and Safari**; dev tooling (Bun 1.4) and Chrome/Firefox are native.

### 1.3 Polyfill choice

| | `temporal-polyfill` (FullCalendar) | `@js-temporal/polyfill` (proposal champions) |
| --- | --- | --- |
| Latest | **1.0.5**, 2026-09-11 | 0.5.1, 2025-03-31 |
| Spec tracked | "Spec date: September 2026"; "Compliance with the latest version of the Temporal spec is near-perfect with just 2 intentional deviations" | 0.5.0 "reflects all changes… between May 2023 and March 2025" (CHANGELOG) — March 2025 snapshot |
| Size (min+gzip, from its README comparison table) | **19.4 kB** (23.3 kB `/full` with all calendars) | 52.1 kB |
| Global install | `import 'temporal-polyfill/global'` — "Uses native if available" | None: "does not install a global `Temporal` object"; named import only |
| Native detection | Yes (`polyfill/src/nativeSwitch.ts`: `NativeTemporal = globalThis.Temporal`) | No |
| Production | 1.0 released; CI on Node 16–26; browsers back to Safari 14 | README: "goal is to be ready for production use when the Temporal proposal reaches Stage 4"; roadmap "Release production version to NPM" unchecked |
| License | MIT | ISC |

Sources: README as published on npm (`npm view temporal-polyfill readme`) and https://github.com/fullcalendar/temporal-polyfill ; https://github.com/js-temporal/temporal-polyfill ; https://www.npmjs.com/package/@js-temporal/polyfill . Bundlephobia numbers **UNVERIFIED** (rate-limited); sizes above are the package's own measurements.

**Decision: `temporal-polyfill`.**

Entry points (README, verbatim names):
- `temporal-polyfill/global` — global polyfill, uses native if available ("What most people need").
- `temporal-polyfill` — side-effect-free ponyfill, uses native if available.
- `temporal-polyfill/implementation` — forced non-native.
- `temporal-polyfill/shim` — `install()` (uses native if available) / `installImplementation()` (force).
- `temporal-polyfill/full/*` — same, with non-ISO calendars.

### 1.4 Wiring so server (workerd) and browser both get it

SvelteKit hooks docs: `src/hooks.server.js`, `src/hooks.client.js` (and universal `src/hooks.js`) — "Code in these modules will run when the application starts up". — https://svelte.dev/docs/kit/hooks

Lesson from workerd#6907: a polyfill guarded only by `typeof Temporal === 'undefined'` silently used the broken native build. A user in that thread worked around it with the forced implementation. Given workerd may re-enable native Temporal at any time, be explicit on the server:

```ts
// src/hooks.server.ts  (runs in workerd in prod, in Bun/Node in `vite dev`)
import { installImplementation } from 'temporal-polyfill/shim';
// Force our own implementation in Workers until Cloudflare ships a `temporal` compat flag
// and we have verified Temporal.Now against Date.now() there.
if (!globalThis.Temporal || typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers') {
  installImplementation();
}
export {};
```

```ts
// src/hooks.client.ts  (browser: Safari needs it; Chrome/Firefox use native)
import 'temporal-polyfill/global';
```

Notes:
- `navigator.userAgent === 'Cloudflare-Workers'` as a Workers detector is **UNVERIFIED** from a primary doc here; a simpler, fully verified alternative is to always `installImplementation()` on the server (costs 19 kB in the worker bundle, nothing in the browser).
- adapter-cloudflare bundles the server into a single `_worker.js`; the polyfill assigns `globalThis.Temporal` at module evaluation, in the same isolate that serves requests. `nodejs_compat` has no documented effect on `Temporal`. — https://svelte.dev/docs/kit/adapter-cloudflare
- Shared domain code (rules engine) should import `{ Temporal }` from `'temporal-polyfill'` (ponyfill, uses native if present) if you want it to work without relying on hook ordering; otherwise the global is fine.

TypeScript: "TypeScript 6.0 now includes built-in types for the Temporal API… via `--target esnext` or `"lib": ["esnext"]` (or the more-granular `esnext.temporal`)". Current `typescript@latest` is 7.0.2. temporal-polyfill README: for TS ≥ 6.0 use `"lib": ["esnext"]` or `["esnext.temporal", "esnext.intl", "esnext.date"]`; for TS < 6.0 add `import 'temporal-polyfill/types/global'`. — https://devblogs.microsoft.com/typescript/announcing-typescript-6-0/

```jsonc
// tsconfig.json (fragment)
{ "compilerOptions": { "lib": ["esnext", "dom", "dom.iterable"] } }
```

### 1.5 Effect DateTime interop

- Representation: `DateTime.Utc`/`Zoned` store `epochMillis`; time zones are `Offset` or `Named` (IANA). — https://effect.website/docs/data-types/datetime/
- `Date` is in the API surface and internals (v3 `DateTime.ts`): `unsafeFromDate(date: Date)`, `DateTime.Input` includes `Date`, `nowAsDate: Effect<Date>`, `toDate`/`toDateUtc(): Date`, `mutate`/`withDate` hand you a mutable `Date`; internals use `Date.now()`, `new Date(ms).getTimezoneOffset()`, `new Date(string)` for parsing. `Clock.currentTimeMillis` returns `Date.now()`; `Schedule` calendar alignment uses `new Date(now)`. — https://github.com/Effect-TS/effect/blob/v3/packages/effect/src/DateTime.ts
- Effect v4 (npm `effect@4.0.0-rc.115`, 2026-09-11; `latest` is 3.22.2): renames to `fromDateUnsafe`/`makeUnsafe`/`nowUnsafe`; `DateTime.Input` now accepts `Instant { epochMilliseconds: number }` and `Duration.Input` accepts Temporal.Duration-like objects (changelog 4.0.0-beta.31 "allow assigning Temporal types to DateTime & Duration input"). No `toTemporal`/`fromTemporal`. — https://github.com/Effect-TS/effect/blob/main/packages/effect/src/DateTime.ts , https://github.com/Effect-TS/effect/blob/main/packages/effect/CHANGELOG.md
- Open v4 issue "Support for Temporal" (Schema for `Temporal.PlainDate` etc.), no maintainer decision. — https://github.com/Effect-TS/effect-smol/issues/1959

Guidance: do **not** avoid Effect's `DateTime`/`Clock` — they are how Effect tests time (TestClock). Keep the ban on `Date` in application code, and bridge without touching `Date`:

```ts
// src/lib/time/bridge.ts — the ONLY file allowed to mention Date (see oxlint overrides)
import { DateTime } from 'effect';
export const toInstant = (dt: DateTime.DateTime) =>
  Temporal.Instant.fromEpochMilliseconds(DateTime.toEpochMillis(dt));
export const fromInstant = (i: Temporal.Instant) =>
  DateTime.unsafeMake(i.epochMilliseconds);        // v3; v4: DateTime.makeUnsafe(i)
```

---

## 2. oxlint: banning `Date` and `throw`

### 2.1 Current state

- `oxlint@1.83.0` (2026-09-14), Node engines `^20.19.0 || >=22.12.0`; 870 rules, 111 on by default (category `correctness`). Config files: `.oxlintrc.json`, `.oxlintrc.jsonc`, `oxlint.config.ts`/`.mts` (one per directory). Keys: `rules`, `categories`, `plugins`, `jsPlugins` (alpha), `overrides`, `extends`, `ignorePatterns`, `env`, `globals`, `settings`, `options`. — https://oxc.rs/docs/guide/usage/linter/rules.html , https://oxc.rs/docs/guide/usage/linter/config.html
- Svelte: oxlint lints "Framework files (.vue, .svelte, .astro) by linting only their `<script>` blocks" — templates are not linted. — https://oxc.rs/docs/guide/usage/linter.html
- JS plugins: "JS plugins are currently in alpha, and remain under active development"; API "compatible with ESLint v9+". Supported: AST traversal, `node.parent`, **Selectors**, `SourceCode` APIs, scope analysis, code paths, fixes, rule options, disable directives, IDE. Not yet: "Custom file formats and parsers (e.g. Svelte, Vue, Angular)" and "Lint rules that rely on TypeScript type-awareness". Alpha post (2026-03-11): "we expect 80% of ESLint users can now switch". Config: `"jsPlugins": ["./plugin.js", "eslint-plugin-foo", { "name": "alias", "specifier": "pkg" }]`. — https://oxc.rs/docs/guide/usage/linter/js-plugins.html , https://oxc.rs/blog/2026-03-11-oxlint-js-plugins-alpha.html , https://oxc.rs/docs/guide/usage/linter/writing-js-plugins.html
- Plugin API surface: plain ESLint object `{ meta: { name }, rules: { x: { create(context) { return { NodeType(node) { context.report(...) } } } } } }`; optional `import { eslintCompatPlugin } from "@oxlint/plugins"` with `createOnce` + `before`/`after`. `@oxlint/plugins@1.83.0` exports `definePlugin`, `defineRule`, `eslintCompatPlugin`; its `index.d.ts` types visitor keys including `ThrowStatement` and `TSTypeReference` — the AST is TS-ESTree ("conforms to @typescript-eslint/typescript-estree's TS-ESTree format", oxc-parser README). `RuleTester` from `oxlint/plugins-dev`. — https://unpkg.com/@oxlint/plugins@1.83.0/index.d.ts , https://unpkg.com/oxc-parser@latest/README.md
- JS plugins need the **npm distribution** of oxlint (the standalone GitHub binary "silently skips loading them", open issue #25203). Running the npm package under Bun (`bunx oxlint`) works for the native linter; for JS plugins a user reports identical output under `bun --bun` but `RuleTester` failing on Bun (issue #26740, 2026-09-16) — Bun as the plugin runtime is **not officially supported / UNVERIFIED**. — https://github.com/oxc-project/oxc/issues/25203 , https://github.com/oxc-project/oxc/issues/26740
- Release tags on GitHub are now `apps_v1.83.0` (shared oxlint+oxfmt), not `oxlint_v*`. — https://github.com/oxc-project/oxc/releases
- Type-aware linting: `oxlint --type-aware` or `options.typeAware: true`, requires `oxlint-tsgolint` (7.0.2001) and TypeScript 7.0+; "59 out of 61 type-aware rules from typescript-eslint". — https://oxc.rs/docs/guide/usage/linter/type-aware.html

### 2.2 Which built-in rules exist (rules page, 2026-09-17)

| Rule | In oxlint? | Useful for |
| --- | --- | --- |
| `eslint/no-restricted-globals` | Yes | Ban the `Date` **value** (`new Date()`, `Date.now()`, `Date.UTC`). Options: strings, `{name, message}`, or `{ globals: [...], checkGlobalObject: bool (default false), globalObjects: ["globalThis","self","window"] }`. Detection is on unresolved references; type positions are skipped (`reference.is_type()`), so `let d: Date` is **not** flagged; with `checkGlobalObject: true` `window.Date`/`globalThis.Date` are flagged. — https://oxc.rs/docs/guide/usage/linter/rules/eslint/no-restricted-globals.html , https://raw.githubusercontent.com/oxc-project/oxc/main/crates/oxc_linter/src/rules/eslint/no_restricted_globals.rs |
| `typescript/no-restricted-types` | Yes | Ban the `Date` **type** in annotations (`types: { Date: { message } }`). — https://oxc.rs/docs/guide/usage/linter/rules/typescript/no-restricted-types.html |
| `eslint/no-restricted-syntax` | **No native rule** (rule page and source 404; maintainers point users to a "custom local JS plugin" — https://github.com/oxc-project/oxc/discussions/11649). **Available as a JS plugin** via the oxc team's `oxlint-plugin-eslint@1.83.0` ("ESLint's built-in rules as an Oxlint plugin", added in oxlint 1.53.0; its README example is literally `no-restricted-syntax` with a `ThrowStatement > CallExpression[...]` selector). — https://unpkg.com/oxlint-plugin-eslint@1.83.0/README.md | Ban `throw` (selector `ThrowStatement`) |
| `functional/no-throw-statements` | **No** (`functional` is not a built-in plugin) | — |
| `eslint/no-throw-literal` / `typescript/only-throw-error` | Yes, but they only forbid throwing **non-Error** values; `no-throw-literal` is "deprecated in favor of `typescript/only-throw-error`", which is type-aware (needs `--type-aware`). — https://oxc.rs/docs/guide/usage/linter/rules/typescript/only-throw-error.html | Not a `throw` ban |
| `unicorn/prefer-date-now`, `unicorn/no-instanceof-builtins` | Yes | Irrelevant once `Date` is banned |

So: **`Date` is fully coverable with built-ins (value + type). `throw` needs a JS plugin rule.**

### 2.3 `.oxlintrc.json` — built-ins only (bans `Date`, cannot ban `throw`)

```jsonc
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["typescript", "unicorn", "import"],
  "categories": { "correctness": "error", "suspicious": "warn" },
  "rules": {
    "no-restricted-globals": [
      "error",
      {
        "globals": [
          { "name": "Date", "message": "Use Temporal (Temporal.Now / Temporal.Instant / Temporal.ZonedDateTime). Date is banned outside src/lib/time/bridge.ts." }
        ],
        "checkGlobalObject": true
      }
    ],
    "typescript/no-restricted-types": [
      "error",
      { "types": { "Date": { "message": "Use Temporal.Instant / Temporal.ZonedDateTime / Temporal.PlainDate instead of Date." } } }
    ]
  },
  "overrides": [
    {
      "files": ["src/lib/time/bridge.ts", "**/*.test.ts"],
      "rules": { "no-restricted-globals": "off", "typescript/no-restricted-types": "off" }
    }
  ]
}
```

(`$schema` path is the conventional one written by `oxlint --init`; exact filename **UNVERIFIED** — drop the line if it does not resolve.)

Coverage of this config (from the rule's test cases): flags `Date.now()`, `new Date()`, `window.Date`, `globalThis.Date`, `let d: Date`. Does **not** flag `Date` reached through an alias (`const D = globalThis['Da'+'te']`) or `Effect.DateTime.toDate(x)` return values — acceptable.

### 2.4 Adding the `throw` ban with a JS plugin (alpha)

**Option A (preferred, no custom code): `oxlint-plugin-eslint`.** Install `bun add -D oxlint-plugin-eslint` (version-lock it to oxlint: both 1.83.0) and add:

```jsonc
{
  "jsPlugins": [{ "name": "eslint-js", "specifier": "oxlint-plugin-eslint" }],
  "rules": {
    "eslint-js/no-restricted-syntax": [
      "error",
      { "selector": "ThrowStatement", "message": "`throw` is forbidden: fail via Effect.fail / Effect.die." }
    ]
  }
}
```

ESLint's option format (mixed strings and `{selector, message}` objects) is documented at https://eslint.org/docs/latest/rules/no-restricted-syntax ; the plugin registers selectors as visitor keys (`rules/no-restricted-syntax.cjs` in the package). You could also fold the `Date` bans in here as extra selectors (`NewExpression[callee.name='Date']`, `CallExpression[callee.object.name='Date']`, `TSTypeReference[typeName.name='Date']`) but the native rules in §2.3 are faster and not alpha — keep those for `Date`.

**Option B: a custom rule** (ESLint-v9-compatible shape; the docs' plugin object is `{ meta: { name }, rules }` and rules use `create(context)` with visitor keys; selectors are listed as supported):

```ts
// tooling/oxlint/tichu-plugin.ts
const noThrow = {
  meta: {
    type: "problem",
    docs: { description: "Errors flow through Effect (Effect.fail / Effect.die); `throw` is forbidden." },
    messages: { noThrow: "`throw` is forbidden: return/yield Effect.fail(...) instead." },
  },
  create(context) {
    return {
      ThrowStatement(node) {
        context.report({ node, messageId: "noThrow" });
      },
    };
  },
};

export default {
  meta: { name: "tichu" },
  rules: { "no-throw": noThrow },
};
```

Config additions:

```jsonc
{
  "jsPlugins": ["./tooling/oxlint/tichu-plugin.ts"],
  "rules": {
    "tichu/no-throw": "error"
  },
  "overrides": [
    { "files": ["src/lib/time/bridge.ts", "**/*.test.ts"], "rules": { "no-restricted-globals": "off", "typescript/no-restricted-types": "off" } },
    { "files": ["**/*.svelte"], "rules": { "tichu/no-throw": "error" } }
  ]
}
```

**Not recommended: `eslint-plugin-functional`** (10.0.1). Its `functional/no-throw-statements` rule ("Disallow throwing exceptions", option `allowToRejectPromises` default false) is declared `requiresTypeChecking: true` in its source (`src/rules/no-throw-statements.ts`, uses `isInPromiseHandlerFunction()`), and oxlint states type-aware JS rules are unsupported — expect it to fail or misbehave under oxlint (**UNVERIFIED** by test). — https://github.com/eslint-functional/eslint-plugin-functional/blob/main/docs/rules/no-throw-statements.md , https://raw.githubusercontent.com/eslint-functional/eslint-plugin-functional/main/src/rules/no-throw-statements.ts

Caveats:
- JS plugins list "Custom file formats and parsers (e.g. Svelte, Vue, Angular)" as unsupported. Whether JS-plugin rules still run on the `<script>` block oxlint extracts from `.svelte` files is **UNVERIFIED** (milestone issue #19918 has "Add tests for linting JS/TS sections of multi-part files" unchecked) — assume the `throw` ban does **not** cover `.svelte` until tested; the built-in `Date` rules do (oxlint lints Svelte script blocks natively; template expressions are never linted). Keep logic out of components (already the plan: rules engine in `.ts`). — https://github.com/oxc-project/oxc/issues/19918
- TS-only nodes (`TSTypeReference`) are typed visitor keys in `@oxlint/plugins`, so a custom rule *could* ban the `Date` type; not needed, since `typescript/no-restricted-types` covers it natively.
- Type-aware rules on `.svelte` do not work ("Type-checking is unavailable" for Vue/Svelte under the script-extraction approach, RFC discussion #21936). — https://github.com/oxc-project/oxc/discussions/21936
- Escapes no syntactic approach catches: `const D = Date; new D()`, `Reflect.construct(Date, …)`, `.svelte` template expressions. Acceptable.

### 2.5 Fallback if the alpha plugin API is unacceptable

Run ESLint alongside for the two rules only, and use `eslint-plugin-oxlint` ("Turn off all rules already supported by oxlint"; recommended script `"lint": "oxlint && eslint"`). — https://github.com/oxc-project/eslint-plugin-oxlint

```js
// eslint.config.js — only the rules oxlint cannot express
import oxlint from 'eslint-plugin-oxlint';
import tseslint from 'typescript-eslint';
export default [
  ...tseslint.configs.base,
  {
    files: ['**/*.ts', '**/*.svelte'],
    rules: {
      'no-restricted-syntax': ['error',
        { selector: 'ThrowStatement', message: 'throw is forbidden; use Effect.fail' },
        { selector: "NewExpression[callee.name='Date']", message: 'Use Temporal' },
        { selector: "CallExpression[callee.object.name='Date']", message: 'Use Temporal' },
        { selector: "TSTypeReference[typeName.name='Date']", message: 'Use Temporal types' },
      ],
    },
  },
  ...oxlint.configs['flat/recommended'],
];
```

### 2.6 CLI flags for hooks/CI

`oxlint --fix` ("Fix as many issues as possible"), `--deny-warnings` ("Ensure warnings produce a non-zero exit code"), `--max-warnings N`, `-c/--config`, `--type-aware`, `-f json|junit|sarif`, `--init`, `--print-config`; explicit file paths accepted. — https://oxc.rs/docs/guide/usage/linter/cli.html

---

## 3. oxfmt

- `oxfmt@0.68.0` (2026-09-14), weekly releases, `engines.node ^20.19.0 || >=22.12.0`. Status: **beta** (alpha 2025-12-01, beta 2026-02-24); no 1.0; the compatibility page still lists "XML / SVG: Planned for Oxfmt 1.0". Production readiness is implied by adopters named in the beta post (Vue core, Turborepo, Sentry), not stated — **UNVERIFIED** as an official claim. — https://oxc.rs/blog/2026-02-24-oxfmt-beta.html , https://oxc.rs/compatibility.html
- Prettier compatibility: "Oxfmt now passes 100% of Prettier's JavaScript and TypeScript conformance tests"; "any formatting differences are considered bugs"; intentional divergences in `apps/oxfmt/DIVERGENCES.md`. — https://oxc.rs/docs/guide/usage/formatter.html , https://github.com/oxc-project/oxc/blob/main/apps/oxfmt/DIVERGENCES.md
- Defaults (config reference): `printWidth: 100` (Prettier: 80 — the one deliberate difference), `tabWidth 2`, `useTabs false`, `semi true`, `singleQuote false`, `trailingComma "all"`, `arrowParens "always"`, `endOfLine "lf"`, `insertFinalNewline true`, `sortPackageJson` **on**, `sortImports` off. Does **not** read `.prettierrc` (use `oxfmt --migrate=prettier`); reads `.editorconfig` (`end_of_line`, `indent_style`, `indent_size`, `max_line_length`, `insert_final_newline`). — https://oxc.rs/docs/guide/usage/formatter/config-file-reference.html , https://oxc.rs/docs/guide/usage/formatter/config.html
- Config files: `.oxfmtrc.json`, `.oxfmtrc.jsonc`, `oxfmt.config.ts`/`.mts`; `oxfmt --init`. Ignore: `ignorePatterns`, `.gitignore`, `.prettierignore`. — https://oxc.rs/docs/guide/usage/formatter/ignore-files.html
- Languages: native (Rust) JS/JSX/TS/TSX, JSON*, CSS/SCSS/Less, GraphQL, TOML, YAML. Prettier-backed via a **bundled Prettier** (npm package only, needs Node): HTML, Angular, Vue, **Svelte**, Markdown, MDX, Handlebars, MJML. "Except `.svelte`, which additionally requires the `svelte` package to be installed and the `svelte` option to be enabled." Embedded `<script>` in Vue/Svelte is formatted by the native formatter. `.astro` is not supported. Added in 0.49.0 (2026-05-11) as "Experimental .svelte support (#21700)". — https://oxc.rs/docs/guide/usage/formatter/language-support.html , https://github.com/oxc-project/oxc/blob/main/apps/oxfmt/CHANGELOG.md
- CLI: `oxfmt [PATH]...` writes by default; `--check`; `--list-different`; `-c`; `--no-error-on-unmatched-pattern`. Exit codes: 0 ok, 1 `InvalidOptionConfig | FormatMismatch`, 2 `NoFilesFound | FormatFailed`. Quickstart lint-staged example: `"*": "oxfmt --no-error-on-unmatched-pattern"`. — https://oxc.rs/docs/guide/usage/formatter/cli.html , https://github.com/oxc-project/oxc/blob/main/apps/oxfmt/src/cli/result.rs , https://oxc.rs/docs/guide/usage/formatter/quickstart.html
- Editor: VS Code `oxc.oxc-vscode`, uses the project-local `oxfmt --lsp`. — https://oxc.rs/docs/guide/usage/formatter/editors.html
- Interaction with oxlint: oxlint's default `correctness` category has no whitespace/semicolon rules; nothing to disable, no `eslint-config-prettier` equivalent needed.

Recommended `.oxfmtrc.json` (single formatter, Svelte included):

```jsonc
{
  "$schema": "./node_modules/oxfmt/configuration_schema.json",
  "printWidth": 100,
  "singleQuote": true,
  "sortImports": true,
  "svelte": { "indentScriptAndStyle": true, "sortOrder": "options-scripts-markup-styles" },
  "ignorePatterns": [".svelte-kit/", "build/", "static/"]
}
```

Fallback if the experimental Svelte path misbehaves — Prettier for `.svelte` only (`prettier-plugin-svelte@4` "only works with prettier@3 and Svelte 5+"; sv CLI's own defaults use `printWidth: 100`, `singleQuote: true`, `useTabs: true`, `trailingComma: 'none'`):

```json
// .prettierrc  — used ONLY for *.svelte; mirror printWidth/quotes with .oxfmtrc.json
{ "printWidth": 100, "singleQuote": true, "trailingComma": "all",
  "plugins": ["prettier-plugin-svelte"],
  "overrides": [{ "files": "*.svelte", "options": { "parser": "svelte" } }] }
```
and add `"**/*.svelte"` to oxfmt `ignorePatterns`. — https://github.com/sveltejs/prettier-plugin-svelte , https://github.com/sveltejs/cli/blob/main/packages/sv/src/addons/prettier.ts

---

## 4. Hooks: husky + lint-staged + oxlint + oxfmt + conventional commits under Bun

### 4.1 Facts

- **Bun runs the root package's lifecycle scripts**: "Runs your project's `{pre|post}install` and `{pre|post}prepare` scripts at the appropriate time." Dependencies' scripts do not run unless in `trustedDependencies`; `--ignore-scripts` disables all. So husky's `prepare` hook installs on `bun install`. — https://bun.com/docs/pm/cli/install
- `bunx` "checks for a locally installed package first"; respects a `#!/usr/bin/env node` shebang (runs under Node) unless `--bun` is passed before the binary; `bunx` = `bun x`. — https://bun.com/docs/cli/bunx
- husky 9.1.7 (published 2024-11-18, Node ≥ 18, zero deps): docs have a Bun tab: `bun add --dev husky`, `bunx husky init` — creates `.husky/pre-commit` and sets `"prepare": "husky"`. Gotchas from husky's own source/issues: (a) `husky init` fills `.husky/pre-commit` from `npm_config_user_agent`, so under `bunx` it writes `bun test` (Bun's built-in runner, not the `test` script — open issue #1563); overwrite it. (b) `bin.js` has `#!/usr/bin/env node`; on a machine without Node, `bun husky` fails (open issue #1586) — use `"prepare": "bunx --bun husky"` if Node is absent. (c) The v9 runner `.husky/_/h` runs each hook with `sh -e` and `export PATH="node_modules/.bin:$PATH"`, so hook files are plain shell with no shebang and bare binary names work; the old `#!/usr/bin/env sh` + `. "$(dirname -- "$0")/_/husky.sh"` lines are deprecated and "WILL FAIL in v10.0.0". (d) For CI/prod installs: `HUSKY=0` env or `"prepare": "husky || true"` (`bun install --production` skips devDependencies so `husky` would be missing). — https://typicode.github.io/husky/get-started.html , https://typicode.github.io/husky/how-to.html , https://raw.githubusercontent.com/typicode/husky/main/bin.js , https://raw.githubusercontent.com/typicode/husky/main/husky , https://github.com/typicode/husky/issues/1563 , https://github.com/typicode/husky/issues/1586
- Bun's own blog corroborates the root-`prepare` behaviour: Bun "runs postinstall scripts for your app's package.json, but ignores dependencies lifecycle hooks. This lets you use `husky`, `lint-staged`…" — https://bun.com/blog/bun-v0.1.7 . `bun ci` = `bun install --frozen-lockfile`; Bun does not auto-enable frozen lockfile in CI. — https://bun.com/docs/cli/install
- lint-staged 17.5.1 (2026-09-10), **`engines.node >=22.22.1`** (v17.0.0 dropped Node 20, requires Git ≥ 2.32, removed `--shell`; deps only `tinyexec`, `picomatch`, `string-argv`). Runs under Node via `bunx lint-staged` (node shebang); **do not pass `--bun`** — Bun issue #11438 reports `bunx --bun lint-staged` failing to read `package.json` config, and #20426 an exit-code mismatch on Windows with no staged files. Config: `lint-staged` key in `package.json`, `.lintstagedrc(.json|.yaml|.mjs|.cjs)`, `lint-staged.config.(js|mjs|cjs)`, `.ts` if the runtime supports it, `defineConfig` from `lint-staged/config`; passes **absolute** file paths appended to the command (`--relative` for relative); `*.ts` matches at any depth; array = sequential. Amusingly, lint-staged's own `lint` script is `"oxfmt && oxlint"`. — https://github.com/lint-staged/lint-staged , https://github.com/lint-staged/lint-staged/releases/tag/v17.0.0 , https://github.com/oven-sh/bun/issues/11438 , https://github.com/oven-sh/bun/issues/20426
- commitlint 21.2.2 (2026-08-13; `@commitlint/cli`, `@commitlint/config-conventional`; Node ≥ 22.12). `@commitlint/cli` depends on `@commitlint/{lint,load,read,format,types,config-conventional}`, `yargs`, `tinyexec` (so the CLI already pulls config-conventional; the bulk is yargs/cosmiconfig/conventional-changelog parsers). `@commitlint/lint` can be used programmatically without the CLI. Config files: `commitlint.config.(js|cjs|mjs|ts|cts|mts)`, `.commitlintrc(.json|.yaml|.yml|.js|.cjs|.mjs|.ts|.cts|.mts)`, or `"commitlint"` in package.json; minimal `extends: ["@commitlint/config-conventional"]`. Getting-started has a Bun tab: `bun add -d @commitlint/cli @commitlint/config-conventional`; local-setup's Bun tab writes `bunx commitlint --edit $1` into `.husky/commit-msg`. config-conventional: types `build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test`; header/body-line/footer-line max 100. — https://commitlint.js.org/guides/getting-started.html , https://commitlint.js.org/guides/local-setup.html , https://commitlint.js.org/reference/configuration.html , https://commitlint.js.org/reference/cli.html
- lefthook 2.1.14 (2026-09-14; Go binary, npm package with per-platform optionalDependencies and a `postinstall` that installs the hooks). `lefthook` is on **Bun's default trusted-dependencies list** (so its postinstall runs on `bun install` — unless you define your own `trustedDependencies`, which replaces the default list). Templates `{staged_files}`, `{all_files}`, `{1}` (first hook arg); `stage_fixed: true` re-`git add`s files a pre-commit job changed. Official commitlint example: `commit-msg` → `run: yarn run commitlint --edit {1}`. — https://github.com/evilmartians/lefthook , https://raw.githubusercontent.com/oven-sh/bun/main/src/install/default-trusted-dependencies.txt , https://bun.com/docs/install/lifecycle
- `commitlint-rs` (Rust, v0.2.4) and `cocogitto` (Rust, 7.0.0) are **not on npm** (registry 404) — cargo/brew installs only; not a fit for a Bun-only toolchain.
- CI: `oven-sh/setup-bun@v2` (latest v2.2.0), reads version from `bun-version`, `packageManager`, `engines.bun`, or `bun-version-file`. commitlint CI docs: checkout with `fetch-depth: 0`; push → `commitlint --last --verbose`; PR → `--from <base.sha> --to <head.sha>`. — https://github.com/oven-sh/setup-bun , https://commitlint.js.org/guides/ci-setup.html
- Current Bun release is 1.4.2 (2026-09-05; 1.4.0 was 2026-08-20). — https://github.com/oven-sh/bun/releases

### 4.2 Snippets

```bash
bun add -D husky lint-staged oxlint oxfmt @commitlint/cli @commitlint/config-conventional svelte
bunx husky init            # writes .husky/pre-commit and "prepare": "husky"
```

`package.json` (fragment):

```jsonc
{
  "scripts": {
    "prepare": "husky",
    "lint": "oxlint --deny-warnings",
    "lint:fix": "oxlint --fix",
    "format": "oxfmt",
    "format:check": "oxfmt --check",
    "check": "bun run lint && bun run format:check && svelte-check"
  },
  "lint-staged": {
    "*.{ts,js,mts,cts,svelte}": ["oxlint --fix --deny-warnings", "oxfmt --no-error-on-unmatched-pattern"],
    "*.{json,jsonc,yaml,yml,css,md}": "oxfmt --no-error-on-unmatched-pattern"
  }
}
```

If Prettier formats `.svelte` instead (fallback in §3), replace the first line with:
```jsonc
"*.{ts,js,mts,cts}": ["oxlint --fix --deny-warnings", "oxfmt --no-error-on-unmatched-pattern"],
"*.svelte": ["oxlint --fix --deny-warnings", "prettier --write"],
```

`.husky/pre-commit`:
```sh
bunx lint-staged
```

`.husky/commit-msg` (exactly what the commitlint docs' Bun tab writes; `bunx` resolves the locally installed package first and runs it under Node per its shebang — add `--bun` before the binary only if Node is not installed):
```sh
bunx commitlint --edit "$1"
```

`package.json` `"prepare"`: use `"husky || true"` if any environment installs with `--production`, or `"bunx --bun husky"` on Node-less machines (see §4.1 gotchas).

`commitlint.config.ts`:
```ts
import type { UserConfig } from '@commitlint/types';
export default {
  extends: ['@commitlint/config-conventional'],
  rules: { 'scope-enum': [2, 'always', ['rules', 'engine', 'ui', 'server', 'lobby', 'bot', 'infra', 'deps']] },
} satisfies UserConfig;
```

Lighter alternative (no commitlint; 0 deps) — regex from the Conventional Commits 1.0.0 spec `type(scope)!: description` (https://www.conventionalcommits.org/en/v1.0.0/#specification), `.husky/commit-msg`:
```sh
#!/bin/sh
msg="$(head -n1 "$1")"
re='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._-]+\))?!?: .{1,72}$'
case "$msg" in
  Merge\ *|Revert\ *|fixup!\ *|squash!\ *) exit 0 ;;
esac
printf '%s' "$msg" | grep -Eq "$re" || {
  echo "Commit message must follow Conventional Commits: type(scope)?: description" >&2
  echo "  got: $msg" >&2
  exit 1
}
```
Trade-off: commitlint validates body/footer rules (`BREAKING CHANGE:`), header length, case, and is what release tooling expects; the shell check only validates the header.

lefthook alternative (replaces husky + lint-staged), `lefthook.yml`:
```yaml
pre-commit:
  parallel: true
  jobs:
    - name: oxlint
      glob: "*.{ts,js,svelte}"
      run: bunx oxlint --fix --deny-warnings {staged_files}
      stage_fixed: true
    - name: oxfmt
      run: bunx oxfmt --no-error-on-unmatched-pattern {staged_files}
      stage_fixed: true
commit-msg:
  jobs:
    - run: bunx commitlint --edit {1}
```
(`stage_fixed`, `{staged_files}` and `{1}` per lefthook's `docs/configuration/{stage_fixed,run}.md`.)

CI (`.github/workflows/ci.yml` fragment):
```yaml
jobs:
  checks:
    runs-on: ubuntu-latest
    env: { HUSKY: 0 }
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }          # commitlint needs history
      - uses: oven-sh/setup-bun@v2
        with: { bun-version-file: package.json }   # or bun-version: 1.4.2
      - run: bun install --frozen-lockfile        # == bun ci
      - run: bun run lint && bun run format:check
      - if: github.event_name == 'pull_request'
        run: bunx commitlint --from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }} --verbose
      - if: github.event_name == 'push'
        run: bunx commitlint --last --verbose
```

---

## Open questions

1. **workerd Temporal timeline.** PR cloudflare/workerd#6943 (compat flag `temporal`, proposed enable date 2026-09-08) is unmerged. Until it merges and `Temporal.Now` is verified against `Date.now()` in a deployed Worker, keep the forced polyfill implementation on the server. Re-check `compatibility-date.capnp` before each `compatibility_date` bump.
2. **Safari 27 stable** — BCD says preview-only, Safari 27.0 notes mention only a Temporal bug fix. Verify in a real Safari 27 before dropping the client polyfill (not soon anyway: iOS lags).
3. **oxlint JS plugins are alpha.** Pin `oxlint` and `oxlint-plugin-eslint` to the same version; the `ThrowStatement` selector is trivial and unlikely to break, but the loader might. Keep the §2.5 ESLint fallback documented. JS plugins need the npm distribution of oxlint; running them under Bun rather than Node is unofficial — verify once with `bunx oxlint` in this repo and, if flaky, run oxlint through Node in hooks/CI.
4. **`throw` inside `.svelte` `<script>`** — JS-plugin coverage of extracted Svelte script blocks is unverified. Test it once (`throw` in a component script must fail lint); if not covered, either keep components logic-free or use the ESLint fallback with `eslint-plugin-svelte` for that one gap.
5. **oxfmt Svelte is experimental** and needs Node for the bundled Prettier path; whether that path runs when oxfmt is launched via `bunx` is **UNVERIFIED** — test once; the Prettier-for-`.svelte`-only fallback is ready.
6. **Effect `Date` surface.** Decide whether test files may use `Date` (overrides above allow it) and whether `DateTime.toDate` calls belong only in `src/lib/time/bridge.ts`.
7. **ECMA-262 merge** of Temporal (tc39/ecma262#3966) is pending; no impact on runtimes, but "ES2026" wording in docs should wait.
