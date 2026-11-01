import { defineConfig } from "vitest/config";

// The server's black-box suite against the built command (`pnpm conformance`).
export default defineConfig({
  test: { include: ["test/conformance.test.ts"], testTimeout: 300_000 },
});
