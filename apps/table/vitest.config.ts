import { defineProject } from "vitest/config";

export default defineProject({
  test: { name: "table", include: ["test/**/*.test.ts"] },
});
