import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";

import { HomeSections } from "../../../../apps/web/src/components/site/HomeSections";
import { PreRegistrationForm } from "../../../../apps/web/src/app/pre-inscricao/PreRegistrationForm";
import { FeatureGrid } from "../../../../apps/web/src/components/site/FeatureGrid";
import { SectionHeading, SiteSection } from "../../../../apps/web/src/components/site/SiteSection";
import { COMING_SOON } from "../../../../apps/web/src/lib/site-content";
import type { PublicPlan } from "../../../../apps/web/src/components/site/Pricing";
import ptMessages from "../../../../packages/config/messages/pt.json";

/**
 * Site público — pré e pós-lançamento, nos dois temas.
 * =========================================================================
 * **Os componentes são os reais.** `HomeSections` é o mesmo que a `page.tsx`
 * de `/` renderiza, e o texto vem do mesmo `site-content.ts`. O que este
 * ficheiro faz é só o que uma storyboard não consegue obter sozinha: dar-lhe o
 * modo do site e o catálogo de planos por prop.
 *
 * Foi por isso que `HomeSections` saiu da `page.tsx` a 7 out 2026. A página é
 * um Server Component que lê `feature_flags` e `plans` — nada disso corre
 * dentro de uma storyboard, e reconstruir a home à mão aqui seria a segunda
 * cópia que o canvas de `legal` já aprendeu a não fazer (ver o comentário de
 * `Ecrans.tsx` desse canvas: "um excerto escrito à mão é uma segunda cópia de
 * um contrato, que diverge à primeira cláusula alterada").
 *
 * **O único dado inventado são os planos**, e é deliberado. Os valores reais
 * em staging são os do teste do Stripe — "Smarter (teste)" a 149,90 €/ano —
 * e rever a página de preços com eles seria rever o ecrã errado. Os números
 * abaixo são os de 07 §8.3, que é o que a página vai mostrar quando o
 * catálogo for corrigido no Admin. Em produção nada disto é lido: a página
 * usa `getPublicPlans()`, e `public-site.test.ts` garante que o que o
 * visitante vê é o que está na base de dados.
 *
 * Três decisões herdadas do canvas `legal`, que custaram tentativas lá:
 *
 *  1. **Sem `intrinsicSizing`** — estas páginas têm largura máxima e
 *     centram-se; medir pelo conteúdo colapsava a moldura e fazia
 *     desaparecer as margens reais.
 *  2. **O tema fixa-se num `data-theme` à volta de cada ecrã**, nunca no
 *     `documentElement`: as storyboards partilham o documento do host, e
 *     escrever na raiz faria a última a renderizar arrastar as outras.
 *  3. **O envoltório pinta o fundo e garante `min-h-screen`**: na app é o
 *     `<body>` que o dá, e dentro de uma storyboard não há `<body>` próprio.
 */

/** Os preços de 07 §8.3 — ver a nota acima sobre porque não são os de staging. */
const PLANOS: PublicPlan[] = [
  {
    slug: "essential-owner",
    name: "Essential",
    audience: "owner",
    priceYearCents: 599,
    priceMonthCents: 69,
    features: ["1 imóvel ativo", "Até 3 visitas agendadas", "Até 1 chat ativo", "Suporte normal"],
    highlighted: false,
  },
  {
    slug: "smarter-owner",
    name: "Smarter",
    audience: "owner",
    priceYearCents: 2990,
    priceMonthCents: 299,
    features: [
      "Até 5 imóveis ativos",
      "Até 5 visitas agendadas",
      "Até 4 chats ativos",
      "Suporte prioritário",
      "Cloud de documentação",
    ],
    highlighted: true,
  },
  {
    slug: "premium-owner",
    name: "Premium",
    audience: "owner",
    priceYearCents: 5990,
    priceMonthCents: 599,
    features: [
      "Imóveis ilimitados",
      "Visitas e agenda ilimitadas",
      "Chats ilimitados",
      "Suporte premium",
      "Cloud de documentação 20 GB",
    ],
    highlighted: false,
  },
  {
    slug: "smarter-buyer",
    name: "Smarter",
    audience: "buyer",
    priceYearCents: 2990,
    priceMonthCents: 299,
    features: [
      "Até 25 imóveis guardados",
      "Até 5 chats ativos",
      "Alertas de descida de preço",
      "Agenda de visitas",
    ],
    highlighted: true,
  },
  {
    slug: "premium-buyer",
    name: "Premium",
    audience: "buyer",
    priceYearCents: 4990,
    priceMonthCents: 499,
    features: [
      "Guardados ilimitados",
      "Chats ilimitados",
      "Alertas em tempo real",
      "Prioridade em visitas",
      "Contratos digitais ilimitados",
    ],
    highlighted: false,
  },
];

/**
 * A moldura: tema por atributo, fundo próprio, mensagens PT.
 *
 * **Porque é que aqui há `ThemeProvider` e no canvas `legal` não.** O
 * `PublicHeader` tem o `ThemeToggle`, que chama `useTheme()` e rebenta sem
 * provider — foi assim que a primeira captura falhou (`useTheme tem de ser
 * usado dentro de <ThemeProvider>`). O provider escreve no `documentElement`,
 * que as storyboards partilham, e é exatamente a armadilha que o canvas
 * `legal` registou.
 *
 * A saída é a ordem: **provider por fora, `data-theme` por dentro**. O
 * atributo mais próximo é o que os tokens CSS resolvem, por isso cada
 * storyboard mantém o seu tema mesmo que o provider ponha outro na raiz. O que
 * fica partilhado é só o estado visual do botão do tema — que não é o que se
 * revê aqui.
 */
function Ecra({ theme, children }: { theme: "light" | "dark"; children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ThemeProvider initialChoice={theme}>
        <div
          data-theme={theme}
          data-app="web"
          style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}
        >
          {children}
        </div>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}

/** Trocar o idioma dentro de uma storyboard não leva a lado nenhum. */
const semEfeito = () => undefined;

/** O formulário do canvas não submete: devolve o estado inicial. */
const semSubmissao = async () => ({});

function Home({ theme, launchMode }: { theme: "light" | "dark"; launchMode: "pre" | "post" }) {
  return (
    <Ecra theme={theme}>
      <HomeSections launchMode={launchMode} plans={PLANOS} locale="pt" onLocaleChange={semEfeito} />
    </Ecra>
  );
}

export function PreLancamentoClaro() {
  return <Home theme="light" launchMode="pre" />;
}

export function PreLancamentoEscuro() {
  return <Home theme="dark" launchMode="pre" />;
}

export function PosLancamentoClaro() {
  return <Home theme="light" launchMode="post" />;
}

export function PosLancamentoEscuro() {
  return <Home theme="dark" launchMode="post" />;
}

/**
 * `/pre-inscricao` — o destino de todos os CTA em modo `pre`.
 *
 * Aqui a moldura reproduz o enquadramento da `page.tsx` em vez de importar o
 * componente de página: essa é `async` e lê `launch_mode`. O que importa
 * rever — o formulário, os consentimentos separados, os quatro cartões — são
 * os componentes reais.
 */
export function PreInscricaoClaro() {
  return (
    <Ecra theme="light">
      <SiteSection>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(20rem, 100%), 1fr))",
            gap: "clamp(1.5rem, 4vw, 3rem)",
            alignItems: "start",
          }}
        >
          <div style={{ display: "grid", gap: "var(--sp-6)" }}>
            <SectionHeading
              eyebrow={COMING_SOON.eyebrow}
              title={COMING_SOON.title}
              body={COMING_SOON.body}
            />
            <FeatureGrid cards={COMING_SOON.cards} minColumn="13rem" />
          </div>
          <PreRegistrationForm onSubmit={semSubmissao} />
        </div>
      </SiteSection>
    </Ecra>
  );
}
