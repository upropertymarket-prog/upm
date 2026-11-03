import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import tempoNextjsPlugin from "tempo-sdk/nextjs";

/**
 * O worker do MapLibre, servido pela própria app (3 nov 2026)
 * =========================================================================
 * O MapLibre 6 descobre o URL do seu worker a partir do `import.meta.url` do
 * próprio módulo. Empacotado pelo webpack do Next, esse URL não é `http(s)`:
 * o worker nascia com URL vazio, falhava ("Worker failed to load"), e o mapa
 * ficava sem mosaicos vetoriais e sem pontos — sem erro nenhum à vista do
 * utilizador. Encontrado pelo E2E do mapa.
 *
 * Copiam-se os dois ficheiros de que o worker precisa (ele importa o
 * `shared` pelo caminho relativo) do pacote instalado para
 * `public/maplibre/<versão>/`. Aqui, e não num script à parte, porque o
 * config corre em todo o `next dev` e `next build` — também nos servidores
 * dos E2E e no deploy — e a cópia acompanha sempre a versão instalada.
 * `PropertyMap` aponta o `setWorkerUrl` para lá. A pasta não vai para o git.
 */
function publicarWorkerDoMaplibre(): void {
  const requerer = createRequire(import.meta.url);
  const pacote = requerer.resolve("maplibre-gl/package.json");
  const { version } = JSON.parse(readFileSync(pacote, "utf8")) as { version: string };
  const origem = join(dirname(pacote), "dist");
  const destino = join(dirname(fileURLToPath(import.meta.url)), "public", "maplibre", version);
  mkdirSync(destino, { recursive: true });
  for (const ficheiro of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
    if (!existsSync(join(destino, ficheiro))) {
      copyFileSync(join(origem, ficheiro), join(destino, ficheiro));
    }
  }
}
publicarWorkerDoMaplibre();

// P1-06 — o plugin liga o `next-intl` ao `src/i18n/request.ts` da app, que
// reexporta a configuração partilhada de `@upm/config/server`.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Os E2E (`packages/e2e`) levantam servidores próprios noutras portas e
  // compilam para `.next-e2e`, para nunca partilharem o `.next` de um
  // `next dev` que esteja a correr — partilhá-lo deixa-o a dar 500 em todas
  // as rotas (o mesmo veneno do `pnpm build`). Sem a variável, nada muda.
  distDir: process.env.UPM_NEXT_DIST_DIR || ".next",
  // `@upm/config` entra aqui por causa do i18n e `@upm/ui` por causa dos
  // componentes e do `next/font/local` das fontes auto-hospedadas (P1-02):
  // o loader de fontes do Next só corre em código que o Next compila.
  // `@upm/cloud` entrou com D71: é o ecrã da Cloud, em TSX e com `next-intl`,
  // partilhado com o acesso interno — publicado como fonte, como os outros.
  transpilePackages: ["@upm/ui", "@upm/db", "@upm/config", "@upm/cloud"],
  typedRoutes: true,
  // P7-03 — o SDK do Stripe fica FORA do bundle do servidor.
  //
  // Sem isto, o webpack empacota o pacote inteiro em cada compilação: em dev,
  // a primeira resposta do webhook `/api/stripe/webhook` levou **695 segundos**,
  // o que torna impossível verificar nada com o `stripe listen`. Como pacote
  // externo, o Node faz `require` dele e a rota compila em segundos.
  serverExternalPackages: ["stripe"],
  // O worker do MapLibre (ver `publicarWorkerDoMaplibre`). Fica fora do
  // middleware, que poria a CSP das páginas — com `strict-dynamic` e um nonce
  // que um worker não tem, o `import` do `shared` seria recusado. Leva a sua
  // própria CSP, de worker: só scripts da própria origem, e rede só para os
  // mosaicos. A versão está no caminho, por isso a cache pode ser eterna.
  async headers() {
    return [
      {
        source: "/maplibre/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'none'; script-src 'self'; connect-src 'self' https://tiles.openfreemap.org; img-src 'self' data: blob: https://tiles.openfreemap.org",
          },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
          { key: "X-Content-Type-Options", value: "nosniff" },
        ],
      },
    ];
  },
};

// `tempo-sdk` tipa o config de entrada com um `NextConfigLike` propositadamente
// laxo (aceita qualquer coisa "parecida" com um next.config, de qualquer
// versão do Next). Isso torna-o estruturalmente incompatível com o `webpack?`
// do `NextConfig` real do Next 15 — o contexto que o Next passa tem mais
// campos do que o tipo do plugin promete. Nenhum dos dois configs desta app
// define `webpack`, por isso não há divergência de comportamento: só o nome
// do tipo, não o valor.
type TempoConfigInput = Parameters<ReturnType<typeof tempoNextjsPlugin>>[0];

// D9 (08 §9, Fase 1) — sem isto, o servidor desta app não injeta as
// anotações `data-tempo-*` e as Route Storyboards de 04 §8.1.2 renderizam
// mas ficam com os elementos por selecionar no canvas. O plugin não faz
// nada a menos que `TEMPO=true`, que o supervisor do Tempo já define ao
// correr `apps[0].start` — fica seguro manter isto permanentemente.
export default withSentryConfig(
  tempoNextjsPlugin()(withNextIntl(nextConfig) as TempoConfigInput) as NextConfig,
  {
    silent: true,
    // Sem upload de source maps enquanto não houver SENTRY_AUTH_TOKEN no CI.
    disableLogger: true,
  },
);
