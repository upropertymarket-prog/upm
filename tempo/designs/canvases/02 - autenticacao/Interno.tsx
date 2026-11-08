import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { AuthCard } from "../../../../apps/interno/src/components/AuthCard";
import { LoginForm } from "../../../../apps/interno/src/app/entrar/LoginForm";
import { RecoverForm } from "../../../../apps/interno/src/app/recuperar/RecoverForm";
import { NewPasswordForm } from "../../../../apps/interno/src/app/nova-palavra-passe/NewPasswordForm";
import { ChallengeForm } from "../../../../apps/interno/src/app/verificar-2fa/ChallengeForm";
import ptMessages from "../../../../packages/config/messages/pt.json";

/**
 * Entrada do interno (a área da equipa) — 8 nov 2026, claro e escuro.
 * =========================================================================
 * Os ecrãs que alguém da equipa vê antes de entrar: a entrada (com o
 * "Esqueci-me"), os dois avisos do caminho de recuperação, o "Esqueci-me" (só
 * para admins, e a resposta, que é sempre a mesma), a palavra-passe nova e o
 * código da 2FA (com a nota de quem perdeu o telemóvel).
 *
 * **O cartão e os formulários são os reais** (`AuthCard` e os quatro
 * formulários de `apps/interno`). Só as Server Actions são de demonstração:
 * vêm por prop exatamente para isto. Os estados que só aparecem depois de um
 * clique ("enviado") entram pelo estado de partida.
 *
 * O tema fica num `data-theme` à volta de cada ecrã, como no resto deste
 * canvas — escrever no `documentElement` arrastava as outras storyboards.
 */

const semSubmissao = async <T,>(estado: T) => estado;

function Ecra({ theme, children }: { theme: "light" | "dark"; children: React.ReactNode }) {
  return (
    <div data-theme={theme} style={{ minHeight: "900px", background: "var(--bg)" }}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <AuthCard>{children}</AuthCard>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

function Entrar({
  theme,
  notice = null,
}: {
  theme: "light" | "dark";
  notice?: "passwordSet" | "linkInvalid" | null;
}) {
  return (
    <Ecra theme={theme}>
      <LoginForm onSubmit={semSubmissao} notice={notice} />
    </Ecra>
  );
}

export const InternoEntrarClaro = () => <Entrar theme="light" />;
export const InternoEntrarEscuro = () => <Entrar theme="dark" />;
export const InternoPalavraPasseDefinida = () => <Entrar theme="light" notice="passwordSet" />;
export const InternoLinkInvalido = () => <Entrar theme="light" notice="linkInvalid" />;

function Recuperar({ theme, enviado }: { theme: "light" | "dark"; enviado: boolean }) {
  return (
    <Ecra theme={theme}>
      <RecoverForm onSubmit={semSubmissao} startState={enviado ? { sent: true } : {}} />
    </Ecra>
  );
}

export const InternoRecuperarClaro = () => <Recuperar theme="light" enviado={false} />;
export const InternoRecuperarEscuro = () => <Recuperar theme="dark" enviado={false} />;
export const InternoRecuperarEnviadoClaro = () => <Recuperar theme="light" enviado />;
export const InternoRecuperarEnviadoEscuro = () => <Recuperar theme="dark" enviado />;

function NovaPalavraPasse({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <NewPasswordForm onSubmit={semSubmissao} />
    </Ecra>
  );
}

export const InternoNovaPalavraPasseClaro = () => <NovaPalavraPasse theme="light" />;
export const InternoNovaPalavraPasseEscuro = () => <NovaPalavraPasse theme="dark" />;

function Verificar2fa({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <ChallengeForm factorId="fator-de-exemplo" onSubmit={semSubmissao} />
    </Ecra>
  );
}

export const InternoVerificar2faClaro = () => <Verificar2fa theme="light" />;
export const InternoVerificar2faEscuro = () => <Verificar2fa theme="dark" />;
