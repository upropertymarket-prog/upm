import { NextIntlClientProvider } from "next-intl";

import { AuthShell } from "../../../../apps/web/src/components/auth/AuthLayout";
import { LoginForm } from "../../../../apps/web/src/app/entrar/LoginForm";
import { RegisterWizard } from "../../../../apps/web/src/app/criar-conta/RegisterWizard";
import { ResendVerificationForm } from "../../../../apps/web/src/app/criar-conta/verificacao/ResendVerificationForm";
import { RequestForm } from "../../../../apps/web/src/app/recuperar-palavra-passe/RequestForm";
import { NewPasswordForm } from "../../../../apps/web/src/app/recuperar-palavra-passe/confirmar/NewPasswordForm";
import { LegalDocumentBody } from "../../../../apps/web/src/components/legal/LegalDocumentBody";
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
 * próprio wizard (P9-05). No lugar dela entrou `/termos`, que é a página que a
 * caixa de aceitação abre.
 */
async function demoAction<State>(state: State) {
  return state;
}

/**
 * Planos de demonstração — fixos, para a storyboard não depender da BD.
 * Os valores são os do `seed.sql` de 07 §8.3, e `commitmentMonths` é o período
 * mínimo decidido a 7 out 2026.
 */
const demoPlans = [
  {
    slug: "essential-owner",
    name: "Essential",
    audience: "owner" as const,
    priceMonthCents: 599,
    priceYearCents: 5990,
    features: ["3 propriedades ativas", "2 GB de Cloud"],
    commitmentMonths: 12,
  },
  {
    slug: "smarter-owner",
    name: "Smarter",
    audience: "owner" as const,
    priceMonthCents: 1499,
    priceYearCents: 14990,
    features: ["10 propriedades ativas", "5 GB de Cloud"],
    commitmentMonths: 12,
  },
  {
    slug: "premium-owner",
    name: "Premium",
    audience: "owner" as const,
    priceMonthCents: 2999,
    priceYearCents: 29990,
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

/** Um excerto da minuta, só para a página `/termos` ter corpo real para medir. */
const demoTermsBody = `> **MINUTA PARA REVISÃO JURÍDICA — NÃO É UM DOCUMENTO DEFINITIVO.**
> Este texto foi redigido como estrutura de trabalho e **tem de ser revisto e
> aprovado por advogado** antes de a plataforma entrar em produção.

## 1. Quem somos e o que este documento é

A plataforma **UProperty Market** é explorada por **[NOME LEGAL DA EMPRESA]**, com sede em
**[MORADA]**, NIPC **[NIPC]**.

## 5. Subscrição, preços e pagamento

O acesso à plataforma **depende de subscrição paga**. Não existe plano gratuito.

## 6. Duração, renovação e período mínimo

**Período mínimo: 12 meses.** A subscrição tem um período mínimo de permanência de **um ano**,
contado desde a data em que é celebrada.

**O período mínimo não afeta o direito de livre resolução de 14 dias** previsto em §7.

## 19. Lacunas assinaladas nesta minuta

| # | Assunto | Onde |
| - | ------- | ---- |
| 2 | Contrapartida por cessação antecipada — não fixada | §8 |
| 3 | Prazos de conservação de dados — não fixados | §12 e §16 |
`;

function Ecra({ theme, children }: { theme: "light" | "dark"; children: React.ReactNode }) {
  return (
    <div data-theme={theme}>
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
        title="Entrar"
        subtitle="Entre para gerir os seus imóveis, visitas e mensagens."
        switchPrompt="Ainda não tem conta?"
        switchHref="/criar-conta"
        switchLabel="Criar conta"
        legalLabel="Termos e Condições"
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
      >
        <RegisterWizard action={demoAction} plans={demoPlans} terms={demoTerms} />
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
        subtitle="Indique o e-mail da conta e enviamos um link para definir uma nova palavra-passe."
        switchPrompt="Lembrou-se da palavra-passe?"
        switchHref="/entrar"
        switchLabel="Entrar"
        legalLabel="Termos e Condições"
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
        subtitle="Escolha uma palavra-passe nova. Tem de ter pelo menos 10 caracteres."
        switchPrompt="Lembrou-se da palavra-passe?"
        switchHref="/entrar"
        switchLabel="Entrar"
        legalLabel="Termos e Condições"
      >
        <NewPasswordForm action={demoAction} />
      </AuthShell>
    </Ecra>
  );
}

/**
 * `/termos` — a página que a caixa de aceitação abre. Mesma composição da
 * página real; o corpo é um excerto, porque a minuta inteira não cabe numa
 * storyboard e o que se revê aqui é o enquadramento, não o texto legal.
 */
function Termos({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <main className="mx-auto w-full max-w-3xl px-4 py-16">
        <header className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold text-text">
            Termos e Condições de Utilização — UProperty Market
          </h1>
          <p className="text-sm text-muted">Versão 2026.10-draft1 · em vigor desde 07/10/2026</p>
          <p
            role="note"
            className="rounded-xl border border-border px-4 py-3 text-sm"
            style={{ background: "var(--warn-soft, var(--surface-2))" }}
          >
            MINUTA PARA REVISÃO JURÍDICA. Este texto não foi revisto por advogado e não substitui
            aconselhamento jurídico. Contém lacunas assinaladas no próprio documento.
          </p>
        </header>
        <article className="mt-8 text-sm text-text">
          <LegalDocumentBody markdown={demoTermsBody} />
        </article>
      </main>
    </Ecra>
  );
}

export const EntrarClaro = () => <Entrar theme="light" />;
export const EntrarEscuro = () => <Entrar theme="dark" />;
export const CriarContaClaro = () => <CriarConta theme="light" />;
export const CriarContaEscuro = () => <CriarConta theme="dark" />;
export const VerificacaoClaro = () => <Verificacao theme="light" />;
export const VerificacaoEscuro = () => <Verificacao theme="dark" />;
export const PedirRecuperacaoClaro = () => <PedirRecuperacao theme="light" />;
export const PedirRecuperacaoEscuro = () => <PedirRecuperacao theme="dark" />;
export const NovaPalavraPasseClaro = () => <NovaPalavraPasse theme="light" />;
export const NovaPalavraPasseEscuro = () => <NovaPalavraPasse theme="dark" />;
export const TermosClaro = () => <Termos theme="light" />;
export const TermosEscuro = () => <Termos theme="dark" />;
