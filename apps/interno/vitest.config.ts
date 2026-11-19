import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // O Vitest não precisa do pipeline PostCSS/Tailwind das páginas.
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: [
      // `server-only` atira fora da condição `react-server` — ver o stub.
      {
        find: /^server-only$/,
        replacement: fileURLToPath(
          new URL("../../packages/db/src/server-only.stub.ts", import.meta.url),
        ),
      },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
