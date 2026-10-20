import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import tempoNextjsPlugin from "tempo-sdk/nextjs";

// P1-06 — o plugin liga o `next-intl` ao `src/i18n/request.ts` da app, que
// reexporta a configuração partilhada de `@upm/config/server`.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // `@upm/config` entra aqui por causa do i18n e `@upm/ui` por causa dos
  // componentes e do `next/font/local` das fontes auto-hospedadas (P1-02):
  // o loader de fontes do Next só corre em código que o Next compila.
  transpilePackages: ["@upm/ui", "@upm/db", "@upm/config"],
  typedRoutes: true,

  /**
   * `/imoveis` → `/propriedades`, em 308 (20 out 2026)
   * -------------------------------------------------------------------------
   * O catálogo público mudou de caminho por decisão do cliente: o texto do
   * site já dizia "propriedades" em todos os sítios e o URL ainda dizia
   * "imóveis" — o `not-found.tsx` tinha um comentário à espera desta mudança.
   *
   * **O redirect não é por causa do índice do Google**, que vai ser refeito de
   * qualquer maneira. É por causa de links que já saíram e que não voltam
   * atrás: as campanhas de e-mail do `mail-worker` e do Admin montam
   * `${WEB_URL}/imoveis/{id}` e **todas as que já foram enviadas ficaram com o
   * caminho antigo na caixa de correio de quem as recebeu**. Sem isto, um
   * clique numa delas dá 404 — e é um 404 em cima de um e-mail de marketing,
   * que é o pior sítio para o dar.
   *
   * Permanente (308, `permanent: true`) e não temporário: a mudança é
   * definitiva, e um 307 pedia ao Google para continuar a visitar o caminho
   * antigo para sempre. O `:slug*` leva o detalhe e o que vier depois dele.
   */
  async redirects() {
    return [
      { source: "/imoveis", destination: "/propriedades", permanent: true },
      { source: "/imoveis/:slug*", destination: "/propriedades/:slug*", permanent: true },
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
