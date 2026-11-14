import { NextIntlClientProvider } from "next-intl";

import { AuthShell } from "../../../../apps/web/src/components/auth/AuthLayout";
import { LoginForm } from "../../../../apps/web/src/app/[locale]/entrar/LoginForm";
import { RegisterWizard } from "../../../../apps/web/src/app/[locale]/criar-conta/RegisterWizard";
import { ResendVerificationForm } from "../../../../apps/web/src/app/[locale]/criar-conta/verificacao/ResendVerificationForm";
import { RequestForm } from "../../../../apps/web/src/app/[locale]/recuperar-palavra-passe/RequestForm";
import { NewPasswordForm } from "../../../../apps/web/src/app/[locale]/recuperar-palavra-passe/confirmar/NewPasswordForm";
import ptMessages from "../../../../packages/config/messages/pt.json";

/**
 * Ecrãs de autenticação — Fase 3 (03 F2, F3) e Fase 9, claro e escuro.
 * =========================================================================
 * Cada página aparece duas vezes, lado a lado: 04 §5.2 trata o modo escuro
 * como requisito, não como variante opcional.
 *
 * **A moldura é a real.** `AuthShell` é o mesmo componente que as cinco
 * `page.tsx` usam — wordmark, cartão, troca entre entrar e criar conta, e o
 * rodapé legal. Antes estava reconstruído aqui dentro com `AuthPage`/`AuthCard`,
 * e era por isso que o canvas mostrava cartões soltos no meio do ecrã enquanto
 * o produto mostrava (ou devia mostrar) uma página. Os formulários também são os
 * reais; só a Server Action é de demonstração, porque as verdadeiras importam
 * `next/headers` e partiriam a compilação do canvas.
 *
 * O tema é fixado num `data-theme` à volta de cada ecrã, e **não** escrito no
 * `documentElement`: as storyboards partilham o documento do host, por isso
 * escrever na raiz faz a última a renderizar arrastar as outras todas — o par
 * claro/escuro aparecia escuro dos dois lados.
 *
 * O wrapper funciona porque `tokens.css` seleciona por `[data-theme="dark"]`,
 * sem prender ao `:root`, e porque o `@theme inline` do host emite `var(--bg)`
 * dentro do utilitário do Tailwind em vez de copiar o valor — as duas metades,
 * design system e Tailwind, seguem o mesmo atributo.
 *
 * Não se usa o `ThemeProvider`: leria o `localStorage`, partilhado pelo host, e
 * estes ecrãs não têm alternador de tema nem precisam do contexto.
 *
 * **7 out 2026:** a storyboard "Escolher plano" desapareceu — a rota
 * `/criar-conta/plano` deixou de existir quando o plano passou a ser um passo do
 * próprio wizard (P9-05).
 *
 * **6 out 2026:** `/termos` saiu daqui para `canvases/legal`. Entrou no lugar
 * do plano por ser a página que a caixa de aceitação abre, mas não é um ecrã de
 * autenticação — só partilhava o ficheiro. Os Termos continuam a ser aceites
 * aqui, no `RegisterWizard`, através de `demoTerms`.
 */
async function demoAction<State>(state: State) {
  return state;
}

/**
 * Planos de demonstração — fixos, para a storyboard não depender da BD.
 * Os valores são os do `seed.sql` (oferta do 1.º ano desde 13 nov 2026), e `commitmentMonths` é o período
 * mínimo decidido a 7 out 2026.
 */
const demoPlans = [
  {
    slug: "essential-owner",
    name: "Essential",
    audience: "owner" as const,
    priceMonthCents: 1999,
    priceYearCents: 19990,
    introMonthCents: 1099,
    introYearCents: 10990,
    introMonths: 12,
    features: ["3 propriedades ativas", "2 GB de Cloud"],
    commitmentMonths: 12,
  },
  {
    slug: "smarter-owner",
    name: "Smarter",
    audience: "owner" as const,
    priceMonthCents: 2999,
    priceYearCents: 29990,
    introMonthCents: 1499,
    introYearCents: 14990,
    introMonths: 12,
    features: ["10 propriedades ativas", "5 GB de Cloud"],
    commitmentMonths: 12,
  },
  {
    slug: "premium-owner",
    name: "Premium",
    audience: "owner" as const,
    priceMonthCents: 4999,
    priceYearCents: 49990,
    introMonthCents: 2999,
    introYearCents: 29990,
    introMonths: 12,
    features: ["Propriedades ilimitadas", "20 GB de Cloud"],
    commitmentMonths: 12,
  },
];

/** Os Termos publicados, como o registo os recebe. */
const demoTerms = {
  documentId: "00000000-0000-4000-8000-000000000001",
  version: "2026.10-draft1",
  contentHash: "0".repeat(64),
  pendingLegalReview: true,
};

function Ecra({ theme, children }: { theme: "light" | "dark"; children: React.ReactNode }) {
  return (
    // `--upm-ecra-alto`: a moldura tem 900 px, e é esse o ecrã que o painel da
    // marca deve encher — sem a variável, `svh` mede a moldura e não um ecrã.
    <div data-theme={theme} style={{ "--upm-ecra-alto": "900px" } as React.CSSProperties}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        {children}
      </NextIntlClientProvider>
    </div>
  );
}

function Entrar({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <AuthShell
        title="Sem pressões, ao seu ritmo."
        subtitle="Entre para gerir os seus imóveis, visitas e mensagens."
        switchPrompt="Ainda não tem conta?"
        switchHref="/criar-conta"
        switchLabel="Criar conta"
        legalLabel="Termos e Condições"
        privacyLabel="Política de Privacidade"
        cookiesLabel="Política de Cookies"
      >
        <LoginForm action={demoAction} />
      </AuthShell>
    </Ecra>
  );
}

function CriarConta({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <AuthShell
        width="lg"
        switchPrompt="Já tem conta?"
        switchHref="/entrar"
        switchLabel="Entrar"
        legalLabel="Termos e Condições"
        privacyLabel="Política de Privacidade"
        cookiesLabel="Política de Cookies"
      >
        <RegisterWizard action={demoAction} plans={demoPlans} terms={demoTerms} />
      </AuthShell>
    </Ecra>
  );
}

/**
 * O passo da **Contratação** — o quarto do assistente (P9-02, P9-09).
 * =========================================================================
 * É o momento em que a pessoa aceita o contrato e autoriza o pagamento, e até
 * 12 out 2026 não existia em storyboard nenhuma: `CriarConta` arranca no
 * Perfil, e para chegar ao quarto passo é preciso escolher perfil, preencher a
 * conta e escolher plano — coisas que uma captura não faz. O ecrã mais
 * delicado do registo revia-se no browser ou não se revia.
 *
 * **Isto é pré-login, e é esse o ponto.** O contrato de adesão mostra-se aqui,
 * dentro do `AuthShell`, antes de existir conta — nada de `AppChrome`, que só
 * aparece depois de entrar. O `/plano/contrato` do canvas `legal` é o outro
 * momento: a cópia do contrato **já celebrado**, consultável pelo titular.
 *
 * O `initialSelection` só fixa o estado de interface que o utilizador poria
 * sozinho em três cliques — perfil de proprietário, Smarter, mensal. É o
 * mesmo recurso que `AppChrome` usa com `liveNotifications`.
 */
function Contratacao({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <AuthShell
        width="lg"
        switchPrompt="Já tem conta?"
        switchHref="/entrar"
        switchLabel="Entrar"
        legalLabel="Termos e Condições"
        privacyLabel="Política de Privacidade"
        cookiesLabel="Política de Cookies"
      >
        <RegisterWizard
          action={demoAction}
          plans={demoPlans}
          terms={demoTerms}
          initialSelection={{
            step: "contract",
            role: "owner",
            planSlug: "smarter-owner",
            interval: "month",
          }}
        />
      </AuthShell>
    </Ecra>
  );
}

function Verificacao({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <AuthShell
        width="md"
        title="Pagamento recebido"
        switchPrompt="Já tem conta?"
        switchHref="/entrar"
        switchLabel="Entrar"
        legalLabel="Termos e Condições"
        privacyLabel="Política de Privacidade"
        cookiesLabel="Política de Cookies"
      >
        <p className="text-sm text-text">
          A subscrição ficou ativa. Falta confirmar o e-mail para entrar na sua conta.
        </p>
        <p className="text-sm text-muted">
          Enviámos um link de confirmação para ana.silva@email.pt.
        </p>
        <ResendVerificationForm email="ana.silva@email.pt" action={demoAction} />
      </AuthShell>
    </Ecra>
  );
}

function PedirRecuperacao({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <AuthShell
        switchPrompt="Lembrou-se da palavra-passe?"
        switchHref="/entrar"
        switchLabel="Entrar"
        legalLabel="Termos e Condições"
        privacyLabel="Política de Privacidade"
        cookiesLabel="Política de Cookies"
      >
        <RequestForm action={demoAction} />
      </AuthShell>
    </Ecra>
  );
}

function NovaPalavraPasse({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <AuthShell
        switchPrompt="Lembrou-se da palavra-passe?"
        switchHref="/entrar"
        switchLabel="Entrar"
        legalLabel="Termos e Condições"
        privacyLabel="Política de Privacidade"
        cookiesLabel="Política de Cookies"
      >
        <NewPasswordForm action={demoAction} />
      </AuthShell>
    </Ecra>
  );
}

export const EntrarClaro = () => <Entrar theme="light" />;
export const EntrarEscuro = () => <Entrar theme="dark" />;
export const CriarContaClaro = () => <CriarConta theme="light" />;
export const CriarContaEscuro = () => <CriarConta theme="dark" />;

export const ContratacaoClaro = () => <Contratacao theme="light" />;
export const ContratacaoEscuro = () => <Contratacao theme="dark" />;
export const VerificacaoClaro = () => <Verificacao theme="light" />;
export const VerificacaoEscuro = () => <Verificacao theme="dark" />;
export const PedirRecuperacaoClaro = () => <PedirRecuperacao theme="light" />;
export const PedirRecuperacaoEscuro = () => <PedirRecuperacao theme="dark" />;
export const NovaPalavraPasseClaro = () => <NovaPalavraPasse theme="light" />;
export const NovaPalavraPasseEscuro = () => <NovaPalavraPasse theme="dark" />;
