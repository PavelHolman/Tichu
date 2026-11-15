# Tichu

A web app where friends play the card game Tichu together, with bots filling empty seats. It supports the standard rules and the Grand Seigneur variant.

## Layout

| Path                | What it is                                                     |
| ------------------- | -------------------------------------------------------------- |
| `packages/engine`   | Rules kernel and the Variants (standard, Grand Seigneur)       |
| `packages/protocol` | Table HTTP and WebSocket message schemas                       |
| `packages/bots`     | Bot interface with random and heuristic Bots                   |
| `apps/table`        | Table Worker: a Cloudflare Durable Object that runs each Table |
| `apps/web`          | SvelteKit PWA with the lobby and the Table                     |

## Development

Requires [Bun](https://bun.sh).

```bash
bun install
bun run dev:table   # Table Worker on http://localhost:8787
bun run dev:web     # web app (set PUBLIC_TABLE_URL to point elsewhere)
```

Checks:

```bash
bun run lint
bun run typecheck
bun run test
bun run test:integration
```

## Docs

- Spec: GitHub issue #1; wayfinder map: issue #3
- Domain glossary: `CONTEXT.md`; decisions: `docs/adr/`
- Research notes: `docs/research/`
