import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "bots", include: ["test/**/*.test.ts"] },
});
