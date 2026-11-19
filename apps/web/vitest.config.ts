import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // O Vitest não precisa do pipeline PostCSS/Tailwind das páginas.
  css: { postcss: { plugins: [] } },
  /**
   * O mesmo `@/` do `tsconfig.json`.
   *
   * Faltava, e não dava por si: os ficheiros sob teste só importavam **tipos**
   * por `@/`, e um `import type` é apagado antes de chegar ao resolvedor. O
   * primeiro `import` de valor — o `canonicalUrl` do e-mail de confirmação —
   * falhou com "Cannot find package '@/lib/seo'", que soa a dependência em
   * falta e é só um alias que o Vitest não conhecia.
   */
  resolve: {
    alias: [
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
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
