import { defineConfig } from "vitest/config";

export default defineConfig({
  // O Vitest não precisa do pipeline PostCSS/Tailwind das páginas.
  css: { postcss: { plugins: [] } },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
