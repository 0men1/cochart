import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@cochart/protocol": fileURLToPath(
        new URL("./packages/protocol/src/index.ts", import.meta.url),
      ),
      "@": fileURLToPath(new URL("./web/src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: [
      "web/src/**/*.test.ts",
      "server/src/**/*.test.ts",
      "bench/src/**/*.test.ts",
    ],
  },
});
