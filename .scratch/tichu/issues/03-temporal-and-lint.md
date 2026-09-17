# 03 How do we enforce Temporal-only time and no-throw with oxlint, and where does Temporal run?

Type: research
Status: resolved
Blocked by: 
Map: ../map.md

## Question

Establish from primary sources: Temporal API support in Bun 1.4, workerd, Node, and current browsers, and the best polyfill if needed (temporal-polyfill versus @js-temporal/polyfill, bundle size). Then establish what oxlint (and oxfmt) can enforce today: is there a rule to forbid the Date global and a rule to forbid throw statements, do oxlint custom or JS plugins exist for writing one, and how oxlint integrates with lint-staged and husky. Include commitlint or an alternative for conventional commits. Deliverable: `.scratch/tichu/research/temporal-and-lint.md` with concrete config snippets.

## Answer

Both bans are enforceable, Temporal needs a polyfill in production. Findings with config snippets and citations: [research/temporal-and-lint.md](../research/temporal-and-lint.md).

- **Temporal support**: TC39 Stage 4. Native in Bun 1.4, Node 26, Chrome 144+, Firefox 139+. Not in Safari stable, and **not in Cloudflare workerd** (a broken native exposure was reverted 2026-08-04; the compat-flag PR is unmerged). So the production runtime needs a polyfill.
- **Polyfill**: `temporal-polyfill` 1.0.5 (about 19 kB min+gzip, tracks the current spec, uses native when present). Avoid `@js-temporal/polyfill`, a stale 2025 snapshot at 52 kB. Wire it at the top of both SvelteKit hooks files; on the server force the polyfill implementation so a half-enabled workerd Temporal cannot hijack the clock. TypeScript 6 ships `lib.esnext.temporal`.
- **Effect DateTime** uses `Date` internally and in its API. Keep it inside Effect code and bridge to Temporal in one allow-listed file via epoch milliseconds.
- **Date ban**: fully native in oxlint 1.83 with `no-restricted-globals` (with `checkGlobalObject`) plus `typescript/no-restricted-types` for type positions. Exact `.oxlintrc.json` in the file.
- **throw ban**: not native to oxlint (no `no-restricted-syntax`). Use the oxlint JS plugin API (alpha since 2026-03) with the oxc team's `oxlint-plugin-eslint` running ESLint's `no-restricted-syntax` on `ThrowStatement`, or a ten-line custom rule. Caveats: JS plugins need the npm distribution of oxlint, Bun as their runtime is unofficial, and coverage of `.svelte` script blocks is UNVERIFIED. ESLint fallback via `eslint-plugin-oxlint` is documented.
- **oxfmt** 0.68 is beta with full Prettier JS/TS conformance; `.svelte` support is experimental (bundles Prettier). Fallback: Prettier plus `prettier-plugin-svelte` scoped to `*.svelte`.
- **Hooks**: husky 9.1 (`bunx husky init`, watch its node shebang), lint-staged 17.5 via `bunx` without `--bun`, commitlint 21 with `config-conventional`. Snippets for package.json, hooks, commitlint, a zero-dependency regex commit-msg hook, lefthook and a GitHub Actions job are in the file.

Consequences: repo layout (06) adopts these configs and must verify the throw ban on `.svelte` script blocks; the Effect-to-Temporal bridge is one named module.
