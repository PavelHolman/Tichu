# Tichu

A web app for playing the card game **Tichu** with friends in the browser. Share a link to a Table, take a Seat,
and bots fill any empty Seats so a game can always start.

**Status:** in development; not deployed yet. Run it locally with two commands (see [Run locally](#run-locally)).

## Features

- **Play by link:** create a Table, send the link, friends join from any device (installable PWA).
- **Bots:** random and heuristic bots take any free Seat.
- **Two rule sets:** standard Tichu and the **Grand Seigneur** variant.
- **Full rules:** combinations, bombs, the Tichu and Grand Tichu calls, the card exchange, the Mah Jong wish
  and the Dragon gift.
- **Robust to dropouts:** a player who goes away can free their Seat or hand it over mid-Match.

## How it's built

- **Pure rules engine** ([`packages/engine`](packages/engine)): deterministic game logic with no I/O, split into a
  shared kernel and pluggable variants ([ADR 0001](docs/adr/0001-pure-engine-with-kernel-and-variant-seam.md)).
- **One Durable Object per Table** ([`apps/table`](apps/table)): a Cloudflare Worker holds each Table's state and
  talks to players over WebSockets ([ADR 0002](docs/adr/0002-cloudflare-durable-objects-with-bun-as-tooling.md)).
- **Typed protocol** ([`packages/protocol`](packages/protocol)): HTTP and WebSocket messages defined as
  [Effect](https://effect.website) schemas shared by server and client.
- **Bots** ([`packages/bots`](packages/bots)): random and heuristic tiers, with room for search-based and learned bots later.
- **Web app** ([`apps/web`](apps/web)): SvelteKit, Svelte 5, Tailwind CSS and shadcn-svelte.

The design was worked out in public GitHub issues first: research, prototypes and decisions, collected in the
[handoff spec (#1)](https://github.com/PavelHolman/tichu/issues/1) and the
[map of open questions (#3)](https://github.com/PavelHolman/tichu/issues/3).

## Run locally

Requires [Bun](https://bun.sh).

```bash
bun install
bun run dev:table   # Table Worker on http://localhost:8787
bun run dev:web     # web app (set PUBLIC_TABLE_URL to point elsewhere)
```

Checks (also run by CI on every push and pull request):

```bash
bun run lint
bun run typecheck
bun run test
bun run test:integration
```

## Repository layout

| Path                | What it is                                                     |
| ------------------- | -------------------------------------------------------------- |
| `packages/engine`   | Rules kernel and the variants (standard, Grand Seigneur)       |
| `packages/protocol` | Table HTTP and WebSocket message schemas                       |
| `packages/bots`     | Bot interface with random and heuristic bots                   |
| `apps/table`        | Table Worker: a Cloudflare Durable Object that runs each Table |
| `apps/web`          | SvelteKit PWA with the lobby and the Table                     |

The game's vocabulary (Table, Seat, Trick, Wish, …) is defined in [`CONTEXT.md`](CONTEXT.md); decisions are in
[`docs/adr/`](docs/adr) and research notes in [`docs/research/`](docs/research).
