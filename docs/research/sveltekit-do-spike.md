# Spike 14: SvelteKit Worker + Table Durable Object Worker, end to end under `wrangler dev`

Research for ticket GitHub issue #17. Date: 2026-09-17. Everything below was run locally on workerd via `wrangler dev` (no Cloudflare account, no deploy; production bundling verified with `wrangler deploy --dry-run`). Spike source is left in the scratchpad at `/private/tmp/claude-501/-Users-pavelholman-Dev-Tichu--claude-worktrees-tichu-game-web-app-920e6a/f36e6455-b92b-4cb6-baa0-6569ab14bde1/scratchpad/spike` (`apps/table`, `apps/web`, `ws-client.ts`, `*.log`).

## Summary

**What worked (all verified):**

1. **Effect 4 (`effect@4.0.0-rc.115`) boots inside a Durable Object on workerd with `nodejs_compat`.** `Layer.succeed` + `Context.Service` + `Effect.fn` + `Schema.Struct` + `Schema.decodeUnknownEffect` + `Effect.runPromise`, built lazily in the DO constructor, works from `fetch`, `webSocketMessage` and `alarm`. Schema failures surface as `SchemaError(Missing key at ["text"])`. No workerd incompatibility hit. Note: rc.115 still calls the DI module `Context` (there is no `ServiceMap.d.ts` in the tarball); the API is `Context.Service<Shape>("Key")`.
2. **Hibernation WebSocket API** (`ctx.acceptWebSocket`, `webSocketMessage`, `webSocketClose`) echoes with a SQLite-persisted sequence number (`ctx.storage.sql`, `new_sqlite_classes` migration).
3. **Alarm** set 2 s after the first message fires at +2.0 s (+2022 ms, +2032 ms, +2079 ms observed), writes a row and broadcasts to all live sockets.
4. **Two-Worker layout**: SvelteKit Worker (`adapter-cloudflare` 7.2.9) binds the DO from the other Worker via `script_name: "tichu-table"`. `platform.env.TABLE.get(...).fetch(...)` from a `+server.ts` works in local dev with **one** `wrangler dev -c apps/web/wrangler.jsonc -c apps/table/wrangler.jsonc` (8 ms first call) and also across **two separate processes** (`vite dev` + `wrangler dev` of the table, via the dev registry, 175 ms first call).
5. **WebSocket upgrade routed THROUGH the SvelteKit Worker works**: a `+server.ts` that returns `stub.fetch(new Request(url, request))` for an upgrade request yields a real 101 and a fully functional socket (echo + alarm), under `wrangler dev`. Not under `vite dev` (see below).
6. **Single-Worker variant works under `wrangler dev` and bundles under `wrangler deploy --dry-run`**: a custom `main: src/worker.ts` that does `import app from '../.svelte-kit/cloudflare/_worker.js'`, `export { Table }`, and `export default { fetch }`, with the DO declared without `script_name`. `platform.env.TABLE` reaches the co-located DO; custom-main `/t/:id/ws` and SvelteKit-routed `/ws-proxy` both upgrade. Wrangler does not serve the `_worker.js` inside the assets directory (404).

**What did not work:**

- **`import { env } from 'cloudflare:workers'` in app code (`+server.ts`) breaks `vite build`** (`ERR_UNSUPPORTED_ESM_URL_SCHEME ... Received protocol 'cloudflare:'`): SvelteKit's build-time analysis loads server modules in Node. Only the adapter's own `_worker.js` template may import it. Use `platform.env`.
- **WebSocket upgrade through `vite dev` crashes the Vite process** (unhandled `read ECONNRESET`, exit code 1). The Node dev server cannot carry a 101 `Response` with a `webSocket`. Under `vite dev`, WS must go directly to the table Worker's own `wrangler dev` port.
- **Single-Worker variant does not work under `vite dev`**: the platform proxy warns "You have defined bindings to the following internal Durable Objects ... These will not work in local development ... define your DO in a separate Worker, with a separate configuration file", and `/api/ping` returns 500 (`no such Durable Object class is exported`). The DO class lives in the custom `main` that Vite never runs. You would have to develop with `vite build && wrangler dev` (no HMR) or keep a second, dev-only config.
- In multi-config `wrangler dev`, **only the first `-c` Worker gets a port**; the table Worker is reachable only through bindings (no `:8787`). A browser "direct" WS needs either two `wrangler dev` processes or the `/ws-proxy` route.

**Recommendation: two Workers** (`apps/web` SvelteKit + `apps/table` DO Worker bound with `script_name`). Every piece is documented by Cloudflare, it is the layout wrangler itself recommends for local DO development, `vite dev` keeps working for the UI with HMR while the table runs in its own `wrangler dev`, and the browser talks WebSocket straight to the table Worker (no proxy hop through SvelteKit, which is also what the DO research advised). The single-Worker variant is technically viable for production (bundles, runs, exports `Table`) but costs the `vite dev` workflow and depends on an undocumented import of the adapter's generated `_worker.js` (adapter 7.2.9; it changed the env mechanism in 7.x, see caveats). Keep it as a documented fallback only.

## Versions actually installed

| package | version |
|---|---|
| effect | 4.0.0-rc.115 (exact) |
| @sveltejs/kit | 2.70.3 |
| @sveltejs/adapter-cloudflare | 7.2.9 |
| @sveltejs/vite-plugin-svelte | 7.3.0 |
| svelte | 5.57.0 |
| vite | 8.3.0 |
| wrangler | 4.133.0 |
| @cloudflare/workers-types | 5.20260917.1 |
| typescript | 6.0.3 (web, from `sv create`), 5.9.3 (table) |
| bun | 1.3.14; node 26.5.0 |

Scaffold command that worked non-interactively:
`bunx sv create web --template minimal --types ts --add "sveltekit-adapter=adapter:cloudflare+cfTarget:workers" --no-download-check --install bun`
It generates `wrangler.jsonc` (with `nodejs_als`, `main: .svelte-kit/cloudflare/_worker.js`, `assets`), `vite.config.ts` (adapter configured there, no `svelte.config.js`), and a `build` script `wrangler types --check && vite build` that fails until `bun run gen` (`wrangler types`) has produced `worker-configuration.d.ts`.

## Final wrangler configs

`apps/table/wrangler.jsonc`:
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "tichu-table",
  "main": "src/index.ts",
  "compatibility_date": "2026-09-01",
  "compatibility_flags": ["nodejs_compat"],
  "durable_objects": { "bindings": [{ "name": "TABLE", "class_name": "Table" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Table"] }]
}
```

`apps/web/wrangler.jsonc` (two-Worker):
```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "tichu-web",
  "compatibility_date": "2026-09-01",
  "compatibility_flags": ["nodejs_compat"],
  "main": ".svelte-kit/cloudflare/_worker.js",
  "assets": { "binding": "ASSETS", "directory": ".svelte-kit/cloudflare" },
  "durable_objects": {
    "bindings": [{ "name": "TABLE", "class_name": "Table", "script_name": "tichu-table" }]
  }
}
```

`apps/web/wrangler.single.jsonc` (single-Worker, Part B):
```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "tichu-single",
  "compatibility_date": "2026-09-01",
  "compatibility_flags": ["nodejs_compat"],
  "main": "src/worker.ts",
  "assets": { "binding": "ASSETS", "directory": ".svelte-kit/cloudflare" },
  "durable_objects": { "bindings": [{ "name": "TABLE", "class_name": "Table" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Table"] }]
}
```

`wrangler types` generated `TABLE: DurableObjectNamespace /* Table from tichu-table */;` for the `script_name` binding (no type of the remote class, as expected).

## DO source that boots Effect (apps/table/src/index.ts, verbatim)

```ts
import { DurableObject } from "cloudflare:workers";
import { Context, Effect, Layer, Schema } from "effect";

const Incoming = Schema.Struct({ text: Schema.String });

interface SeqStoreShape {
  readonly append: (kind: string, text: string) => Effect.Effect<number>;
  readonly count: () => Effect.Effect<number>;
}
const SeqStore = Context.Service<SeqStoreShape>("SeqStore");

const makeSeqStoreLayer = (sql: SqlStorage) =>
  Layer.succeed(SeqStore)({
    append: (kind, text) =>
      Effect.sync(() => {
        sql.exec("INSERT INTO log (kind, text, at) VALUES (?, ?, ?)", kind, text, Date.now());
        return Number(sql.exec("SELECT MAX(seq) AS seq FROM log").one().seq);
      }),
    count: () => Effect.sync(() => Number(sql.exec("SELECT COUNT(*) AS n FROM log").one().n)),
  });

const handleMessage = Effect.fn("handleMessage")(function* (raw: string) {
  const store = yield* SeqStore;
  const parsed = yield* Schema.decodeUnknownEffect(Incoming)(JSON.parse(raw));
  const seq = yield* store.append("msg", parsed.text);
  return { seq, echo: parsed.text };
});

export class Table extends DurableObject<Env> {
  private layer: Layer.Layer<SeqStoreShape>;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS log (seq INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, text TEXT, at INTEGER)",
    );
    this.layer = makeSeqStoreLayer(ctx.storage.sql);
  }
  private run<A, E>(eff: Effect.Effect<A, E, SeqStoreShape>) {
    return Effect.runPromise(Effect.provide(eff, this.layer));
  }
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/ws")) {
      if (request.headers.get("Upgrade") !== "websocket") return new Response("expected websocket", { status: 426 });
      const pair = new WebSocketPair();
      this.ctx.acceptWebSocket(pair[1]);
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    if (url.pathname.endsWith("/state")) {
      const n = await this.run(Effect.flatMap(SeqStore, (s) => s.count()));
      return Response.json({ rows: n, sockets: this.ctx.getWebSockets().length, effectBooted: true });
    }
    return new Response("not found", { status: 404 });
  }
  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const raw = typeof message === "string" ? message : new TextDecoder().decode(message);
    try {
      const out = await this.run(handleMessage(raw));
      ws.send(JSON.stringify(out));
      if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + 2000);
    } catch (e) {
      ws.send(JSON.stringify({ error: String(e) }));
    }
  }
  async webSocketClose(ws: WebSocket, code: number) { ws.close(code, "bye"); }
  async alarm() {
    const seq = await this.run(Effect.flatMap(SeqStore, (s) => s.append("alarm", "alarm fired")));
    console.log(`[table] alarm fired, wrote row seq=${seq}`);
    for (const ws of this.ctx.getWebSockets()) ws.send(JSON.stringify({ seq, alarm: "alarm fired" }));
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const m = new URL(request.url).pathname.match(/^\/t\/([^/]+)\/(ws|state)$/);
    if (!m) return new Response("usage: /t/:id/ws or /t/:id/state", { status: 404 });
    return env.TABLE.get(env.TABLE.idFromName(m[1])).fetch(request);
  },
} satisfies ExportedHandler<Env>;
interface Env { TABLE: DurableObjectNamespace<Table> }
```

SvelteKit side (`apps/web/src/routes/ws-proxy/+server.ts`):
```ts
export const GET: RequestHandler = async ({ request, platform }) => {
  const ns = (platform?.env as { TABLE: DurableObjectNamespace }).TABLE;
  const stub = ns.get(ns.idFromName('x'));
  const url = new URL(request.url); url.pathname = '/t/x/ws';
  return stub.fetch(new Request(url, request));   // 101 passes through the adapter untouched
};
```

Single-Worker entry (`apps/web/src/worker.ts`):
```ts
import app from '../.svelte-kit/cloudflare/_worker.js';
import { Table } from '../../table/src/index';
export { Table };
export default {
  async fetch(request, env, ctx) {
    const m = new URL(request.url).pathname.match(/^\/t\/([^/]+)\/(ws|state)$/);
    if (m) return env.TABLE.get(env.TABLE.idFromName(m[1])).fetch(request);
    return app.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
```

## Dev commands that worked

- Table alone: `cd apps/table && npx wrangler dev --port 8787`
- Both, one process (documented multi-config): `npx wrangler dev -c apps/web/wrangler.jsonc -c apps/table/wrangler.jsonc --port 8788` (run from the spike root; requires `bun run build` in `apps/web` first because `main` is the built `_worker.js`). Only `tichu-web` gets a port.
- Two processes: `apps/table: wrangler dev --port 8787` + `apps/web: vite dev --port 5174`. HTTP DO calls from SvelteKit work via the dev registry; WS must target :8787 directly.
- Single-Worker: `cd apps/web && bun run build && npx wrangler dev -c wrangler.single.jsonc --port 8789`.

Port 5173 was already occupied on this machine (unrelated process), hence the odd ports.

## Test transcript excerpts

Table Worker alone (first run ever):
```
$ curl http://localhost:8787/t/abc/state
{"rows":0,"sockets":0,"effectBooted":true}   time_total=0.400s   (server log: 362ms)
$ curl http://localhost:8787/t/abc/ws         -> "expected websocket" http=426
$ bun ws-client.ts ws://localhost:8787/t/abc/ws
+154ms open
+176ms recv {"seq":1,"echo":"hello"}
+474ms recv {"seq":2,"echo":"world"}
+796ms recv {"error":"SyntaxError: Unexpected token 'o', \"not json\" is not valid JSON"}
+1075ms recv {"error":"SchemaError(Missing key\n  at [\"text\"])"}
+2186ms recv {"seq":3,"alarm":"alarm fired"}
+4518ms close 1000
$ curl http://localhost:8787/t/abc/state
{"rows":3,"sockets":0,"effectBooted":true}
dev log: [wrangler:info] GET /t/abc/ws 101 Switching Protocols (14ms)
         [table] alarm fired, wrote row seq=3
```

Multi-config dev (two Workers, one process, port 8788):
```
startup banner: env.TABLE (Table, defined in tichu-table)  Durable Object  local [not connected]   <- misleading, works
$ curl http://localhost:8788/api/ping
{"ok":true,"status":200,"body":{"rows":0,"sockets":0,"effectBooted":true},"ms":8}   http=200 time_total=0.018s
$ bun ws-client.ts ws://localhost:8788/ws-proxy
+13ms open
+19ms recv {"seq":1,"echo":"hello"}
+316ms recv {"seq":2,"echo":"world"}
+2022ms recv {"seq":3,"alarm":"alarm fired"}
dev log: [wrangler:info] GET /ws-proxy 101 Switching Protocols (10ms)
         [tichu-table] [table] alarm fired, wrote row seq=3
$ curl http://localhost:8788/api/ping  -> "rows":3
```

`vite dev` (5174) + separate `wrangler dev` (8787):
```
$ curl http://localhost:5174/api/ping
{"ok":true,...,"ms":175}   http=200 time_total=1.997s   (first hit; includes proxy spin-up)
$ bun ws-client.ts ws://localhost:5174/ws-proxy
+4504ms error WebSocket connection to 'ws://localhost:5174/ws-proxy' failed: WebSocket is closed before the connection is established
vite log: Error: read ECONNRESET ... error: script "dev" exited with code 1
$ bun ws-client.ts ws://localhost:8787/t/sep/ws   -> full echo + alarm at +2079ms
```

Single Worker (8789):
```
$ curl http://localhost:8789/api/ping   -> {"ok":true,"status":200,"body":{"rows":0,...},"ms":9}
$ curl http://localhost:8789/t/y/state  -> {"rows":0,"sockets":0,"effectBooted":true}
$ bun ws-client.ts ws://localhost:8789/t/y/ws     -> echo seq 1,2 + alarm at +2032ms
$ bun ws-client.ts ws://localhost:8789/ws-proxy   -> echo seq 1,2 + alarm at +2029ms
$ curl http://localhost:8789/_worker.js -> 404 ; /robots.txt -> 200
```

`vite dev` with `platformProxy.configPath: 'wrangler.single.jsonc'`:
```
WARNING You have defined bindings to the following internal Durable Objects: {"name":"TABLE","class_name":"Table"}
        These will not work in local development, but they should work in production.
A DurableObjectNamespace in the config referenced the class "Table", but no such Durable Object class is exported from the worker.
[500] GET /api/ping  -> {"message":"Internal Error"}
```

## Cold-start numbers (local workerd, M-series Mac; not production)

- `wrangler dev` process ready: 2.5–4 s after spawn.
- First request after process start, new DO id (constructor + `CREATE TABLE` + Effect layer + `runPromise`): **17 ms, 30 ms, 40 ms** server-side over three restarts (curl total 18–43 ms). The very first run ever was 362 ms (esbuild/state cache initialization, not repeatable).
- Second request same DO: 4–10 ms. First request to a second DO id on a warm isolate: 5–16 ms.
- Through SvelteKit: `/api/ping` 8 ms (`ms` inside the handler) on first hit in multi-config mode; page `/` 36 ms cold.
- Production bundle (`wrangler deploy --dry-run`): table 700 KiB / **139 KiB gzip** (Effect barrel import, no minify); web 365 KiB / 85 KiB gzip; single 1070 KiB / 225 KiB gzip. All far below the 64 MiB limit. Real Cloudflare cold start not measurable without an account.

## Errors hit and fixes

1. `tsc` errors inside `effect/dist/*.d.ts` (`AsyncDisposable`, `Symbol.asyncDispose`, `TextDecoderOptions`, `Storage`) with `lib: ["ES2022"]`. Fix: `"lib": ["ESNext", "DOM"], "skipLibCheck": true`.
2. `bun run build` in the scaffold fails with `Types file not found at worker-configuration.d.ts` because the script is `wrangler types --check && vite build`. Fix: run `bun run gen` once (and after every wrangler config change). `wrangler types` also nags to install `@types/node` under `nodejs_compat`.
3. `vite build` crashed with `ERR_UNSUPPORTED_ESM_URL_SCHEME ... 'cloudflare:'` after importing `cloudflare:workers` in `+server.ts`. Fix: use `platform.env` only.
4. `wrangler dev --port 5173`: `Address already in use ([::1]:5173)` (foreign process). Fix: other ports.
5. `vite dev` process died on the `/ws-proxy` upgrade (`read ECONNRESET`, unhandled). No fix; do not route WS through `vite dev`.
6. Single-Worker config under `vite dev`: internal DO binding unsupported (see transcript). No fix short of `vite build && wrangler dev`.
7. Startup banner says the `script_name` binding is `[not connected]` in multi-config mode; it is a stale/misleading label, calls work.

## Adapter version caveats (adapter-cloudflare 7.2.9)

- The generated `_worker.js` (`files/worker.js`) does `import { env } from "cloudflare:workers"` at module scope and passes it to `server.init({ env })` (this is the kit PR #16754 change), **and still** passes `platform: { env, ctx, context (deprecated), caches, cf }` into `server.respond`. So `platform.env` still works in 7.2.9; both mechanisms coexist. Because `_worker.js` imports `cloudflare:workers` at top level, the single-Worker custom `main` only runs on workerd (and the two `cloudflare:workers` imports survived into the dry-run bundle fine).
- The adapter's `index.d.ts` exposes `platformProxy: { configPath, environment, persist }`; `configPath` was needed to point `vite dev` at `wrangler.single.jsonc`.
- No public API for extra exports from `_worker.js`; the single-Worker variant relies on importing the generated file by path, which is unsupported and may break with adapter releases (kit PR #16705 is the tracked fix).

## Open questions

- Real Cloudflare cold start and whether hibernation actually evicts the DO between messages (local dev never hibernates observably; `getWebSockets()` after client close returned 0 so cleanup works, but eviction/rehydration of the Effect layer on wake was not exercised).
- `Error.stackTraceLimit = 0` and `Effect.fn` count vs the startup CPU budget were not measured here (bundle is unminified, one `Effect.fn`).
- Whether the WebSocket proxied through the SvelteKit Worker preserves `cf` properties / client IP identically to a direct route; the proxied request was rebuilt with `new Request(url, request)` and worked, but headers were not diffed.
- Cross-Worker `script_name` binding in production requires the table Worker to be deployed first (migration `v1` lives in the table config); ordering in CI is untested.
- `@effect/sql-sqlite-do` was not used (raw `ctx.storage.sql`); its transaction issues on workerd remain untested.
- `vite dev` + two processes worked for HTTP, but the dev-registry hop cost 175 ms on first call; not measured for steady state.
