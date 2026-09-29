import { NextIntlClientProvider } from "next-intl";

import { AuthCard, AuthPage, AuthTitle } from "../../../../apps/web/src/components/auth/AuthLayout";
import { LoginForm } from "../../../../apps/web/src/app/entrar/LoginForm";
import { RegisterWizard } from "../../../../apps/web/src/app/criar-conta/RegisterWizard";
import { ResendVerificationForm } from "../../../../apps/web/src/app/criar-conta/verificacao/ResendVerificationForm";
import { PlanForm } from "../../../../apps/web/src/app/criar-conta/plano/PlanForm";
import { RequestForm } from "../../../../apps/web/src/app/recuperar-palavra-passe/RequestForm";
import { NewPasswordForm } from "../../../../apps/web/src/app/recuperar-palavra-passe/confirmar/NewPasswordForm";
import ptMessages from "../../../../packages/config/messages/pt.json";

/**
 * Ecrãs de autenticação — Fase 3 (03 F2, F3), claro e escuro.
 * =========================================================================
 * Cada página aparece duas vezes, lado a lado: 04 §5.2 trata o modo escuro
 * como requisito, não como variante opcional.
 *
 * O invólucro (`AuthPage`/`AuthCard`/`AuthTitle`) é o mesmo componente que as
 * seis `page.tsx` usam — antes estava copiado aqui dentro, e bastava um
 * `py-16` virar `py-10` para o canvas deixar de dizer a verdade sobre o
 * produto. Os formulários são os reais; só a Server Action é que é de
 * demonstração, porque as verdadeiras importam `next/headers` e partiriam a
 * compilação do canvas.
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
 */
async function demoAction<State>(state: State) {
  return state;
}

/** Planos de demonstração — fixos, para a storyboard não depender da BD. */
const demoPlans = [
  {
    id: "plan-free",
    slug: "gratuito",
    name: "Gratuito",
    price_month_cents: null,
    price_year_cents: null,
  },
  {
    id: "plan-smarter",
    slug: "smarter",
    name: "Smarter",
    price_month_cents: 2990,
    price_year_cents: 29900,
  },
  {
    id: "plan-premium",
    slug: "premium",
    name: "Premium",
    price_month_cents: 5990,
    price_year_cents: 59900,
  },
];

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
      <AuthPage>
        <AuthCard>
          <AuthTitle>Entrar</AuthTitle>
          <LoginForm action={demoAction} />
        </AuthCard>
      </AuthPage>
    </Ecra>
  );
}

function CriarConta({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <AuthPage>
        <RegisterWizard action={demoAction} />
      </AuthPage>
    </Ecra>
  );
}

function Verificacao({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <AuthPage>
        <AuthCard width="md" centered>
          <AuthTitle>Verifique o seu e-mail</AuthTitle>
          <p className="text-sm text-muted">
            Enviámos um link de confirmação para ana.silva@email.pt.
          </p>
          <ResendVerificationForm email="ana.silva@email.pt" action={demoAction} />
        </AuthCard>
      </AuthPage>
    </Ecra>
  );
}

function Plano({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <AuthPage>
        <AuthCard width="lg">
          <AuthTitle>Escolha um plano</AuthTitle>
          <p className="text-sm text-muted">Pode mudar de plano mais tarde em Definições.</p>
          <PlanForm plans={demoPlans} action={demoAction} />
        </AuthCard>
      </AuthPage>
    </Ecra>
  );
}

function PedirRecuperacao({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <AuthPage>
        <AuthCard>
          <RequestForm action={demoAction} />
        </AuthCard>
      </AuthPage>
    </Ecra>
  );
}

function NovaPalavraPasse({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <AuthPage>
        <AuthCard>
          <NewPasswordForm action={demoAction} />
        </AuthCard>
      </AuthPage>
    </Ecra>
  );
}

export const EntrarClaro = () => <Entrar theme="light" />;
export const EntrarEscuro = () => <Entrar theme="dark" />;
export const CriarContaClaro = () => <CriarConta theme="light" />;
export const CriarContaEscuro = () => <CriarConta theme="dark" />;
export const VerificacaoClaro = () => <Verificacao theme="light" />;
export const VerificacaoEscuro = () => <Verificacao theme="dark" />;
export const PlanoClaro = () => <Plano theme="light" />;
export const PlanoEscuro = () => <Plano theme="dark" />;
export const PedirRecuperacaoClaro = () => <PedirRecuperacao theme="light" />;
export const PedirRecuperacaoEscuro = () => <PedirRecuperacao theme="dark" />;
export const NovaPalavraPasseClaro = () => <NovaPalavraPasse theme="light" />;
export const NovaPalavraPasseEscuro = () => <NovaPalavraPasse theme="dark" />;
