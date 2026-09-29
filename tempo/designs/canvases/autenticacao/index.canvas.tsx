import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { NextIntlClientProvider } from "next-intl";

import { LoginForm } from "../../../../apps/web/src/app/entrar/LoginForm";
import { RegisterWizard } from "../../../../apps/web/src/app/criar-conta/RegisterWizard";
import { RequestForm } from "../../../../apps/web/src/app/recuperar-palavra-passe/RequestForm";
import { NewPasswordForm } from "../../../../apps/web/src/app/recuperar-palavra-passe/confirmar/NewPasswordForm";
import ptMessages from "../../../../packages/config/messages/pt.json";

/**
 * Ecrãs de autenticação — Fase 3 (03 F2, F3).
 *
 * As Server Actions reais (`signIn`, `registerAccount`, …) importam
 * `next/headers`, exclusivo do servidor — importá-las aqui partiria a
 * compilação do canvas para o projeto inteiro. Os componentes recebem a
 * action por prop (ver `LoginFormProps`/`RegisterWizardProps`/…); a app real
 * injeta a Server Action verdadeira na respetiva `page.tsx`, este canvas
 * injeta estas versões de demonstração, sem qualquer efeito.
 */
async function demoAction<State>(state: State) {
  return state;
}

/**
 * Cada storyboard corre no seu próprio root isolado (mesma observação do
 * canvas "App Shell" sobre o `ThemeProvider`) — um `NextIntlClientProvider`
 * no root layout do sidecar (`tempo/app/layout.tsx`) NÃO chega. Os
 * componentes reais usam `useTranslations()` (`next-intl`), por isso cada
 * storyboard precisa do seu próprio provider, com as mensagens PT reais.
 */
function withIntl(children: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * Cartão centrado, EXATAMENTE como a página real envolve o formulário (ver
 * `apps/web/src/app/entrar/page.tsx` e as 3 páginas irmãs) — sem isto o
 * formulário fica sem o `position: relative` de que o honeypot (`absolute
 * -left-[9999px]` em `LoginForm.tsx`) precisa para não escapar do fluxo
 * normal, e a medição de tamanho intrínseco do storyboard sai completamente
 * errada (era o que causava a faixa horizontal espremida vista antes desta
 * correção — nada a ver com o `NextIntlClientProvider`).
 */
function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex items-center justify-center bg-bg px-4 py-10">
      <div className="relative mx-auto flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        {children}
      </div>
    </main>
  );
}

/** RegisterWizard já traz o seu próprio `Card` — só precisa do fundo centrado. */
function AuthShell({ children }: { children: React.ReactNode }) {
  return <main className="flex items-center justify-center bg-bg px-4 py-10">{children}</main>;
}

export default function AutenticacaoCanvas() {
  return (
    <Canvas name="Autenticacao" backgroundColor="#232323">
      <Storyboard
        id="LoginForm"
        name="Login (web /entrar)"
        component={() =>
          withIntl(
            <AuthCard>
              <h1 className="text-lg font-semibold text-text">Entrar</h1>
              <LoginForm action={demoAction} />
            </AuthCard>,
          )
        }
        layout={{ x: 0, y: 0, width: 460, height: 480, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="RegisterWizard"
        name="Registo (web /criar-conta)"
        component={() =>
          withIntl(
            <AuthShell>
              <RegisterWizard action={demoAction} />
            </AuthShell>,
          )
        }
        layout={{ x: 510, y: 0, width: 560, height: 320, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="RequestForm"
        name="Pedir recuperação (web /recuperar-palavra-passe)"
        component={() =>
          withIntl(
            <AuthCard>
              <RequestForm action={demoAction} />
            </AuthCard>,
          )
        }
        layout={{ x: 1120, y: 0, width: 460, height: 420, intrinsicSizing: "root-element" }}
      />
      <Storyboard
        id="NewPasswordForm"
        name="Definir nova password (web /recuperar-palavra-passe/confirmar)"
        component={() =>
          withIntl(
            <AuthCard>
              <NewPasswordForm action={demoAction} />
            </AuthCard>,
          )
        }
        layout={{ x: 1630, y: 0, width: 460, height: 420, intrinsicSizing: "root-element" }}
      />
    </Canvas>
  );
}
