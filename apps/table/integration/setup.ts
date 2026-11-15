import { spawn, type ChildProcess } from "node:child_process";

export const PORT = 8798;
let wrangler: ChildProcess | undefined;

/** Starts the Table Worker under `wrangler dev` with throwaway local state. */
export async function setup() {
  wrangler = spawn(
    "bunx",
    ["wrangler", "dev", "--port", String(PORT), "--persist-to", ".wrangler/integration"],
    { cwd: new URL("..", import.meta.url).pathname, stdio: "ignore", detached: true },
  );
  for (let attempt = 0; attempt < 60; attempt++) {
    const up = await fetch(`http://localhost:${PORT}/`).then(
      () => true,
      () => false,
    );
    if (up) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  await teardown();
  return Promise.reject(new Error("wrangler dev did not start"));
}

export async function teardown() {
  if (wrangler?.pid !== undefined) process.kill(-wrangler.pid, "SIGTERM");
}
