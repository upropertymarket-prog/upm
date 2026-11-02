import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import tempoNextjsPlugin from "tempo-sdk/nextjs";

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
  // partilhado com a app — publicado como fonte, como os outros pacotes.
  transpilePackages: ["@upm/ui", "@upm/db", "@upm/config", "@upm/cloud"],
  typedRoutes: true,
  // P7-03 — o SDK do Stripe fica FORA do bundle do servidor.
  //
  // Sem isto, o webpack empacota o pacote inteiro em cada compilação: em dev,
  // a primeira resposta do webhook `/api/stripe/webhook` levou **695 segundos**,
  // o que torna impossível verificar nada com o `stripe listen`. Como pacote
  // externo, o Node faz `require` dele e a rota compila em segundos.
  serverExternalPackages: ["stripe"],
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
