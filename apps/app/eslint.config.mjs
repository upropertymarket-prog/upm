import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      // A pasta de build dos servidores dos E2E (`packages/e2e`) — gerada.
      ".next-e2e/**",
      ".next-e2e-pre/**",
      // O worker do MapLibre, copiado do pacote pelo `next.config.ts` — gerado.
      "public/maplibre/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
