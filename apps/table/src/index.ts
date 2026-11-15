import { installImplementation } from "temporal-polyfill/shim";
// Force our Temporal implementation in workerd until a native one is verified there.
installImplementation();

import { paths } from "@tichu/protocol";

export { Table } from "./table.ts";

const ID_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/** A short unguessable Table id: 10 base62 characters, about 59 bits. */
const newTableId = (): string =>
  Array.from(crypto.getRandomValues(new Uint8Array(10)), (byte) => ID_ALPHABET[byte % 62]).join("");

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const withCors = (response: Response): Response => {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(cors)) headers.set(name, value);
  return new Response(response.body, { status: response.status, headers });
};

const TABLE_PATH = /^\/api\/tables\/([0-9A-Za-z]{10})(?:\/(seats|socket))?$/;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

    if (url.pathname === paths.tables && request.method === "POST") {
      const id = newTableId();
      const stub = env.TABLE.get(env.TABLE.idFromName(id));
      const init = new Request(new URL(`${paths.table(id)}/init`, url), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: await request.text(),
      });
      return withCors(await stub.fetch(init));
    }

    const match = TABLE_PATH.exec(url.pathname);
    if (match?.[1] !== undefined) {
      const stub = env.TABLE.get(env.TABLE.idFromName(match[1]));
      return withCors(await stub.fetch(request));
    }

    return withCors(
      Response.json({ error: "NotFound", message: "Unknown route" }, { status: 404 }),
    );
  },
} satisfies ExportedHandler<Env>;
