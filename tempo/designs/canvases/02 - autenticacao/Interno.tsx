import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { AuthCard } from "../../../../apps/interno/src/components/AuthCard";
import { LoginForm } from "../../../../apps/interno/src/app/entrar/LoginForm";
import { ChallengeForm } from "../../../../apps/interno/src/app/verificar-2fa/ChallengeForm";
import ptMessages from "../../../../packages/config/messages/pt.json";

/**
 * Entrada do interno (a área da equipa) — 8 nov 2026, claro e escuro.
 * =========================================================================
 * Os ecrãs que alguém da equipa vê antes de entrar: a entrada (com a nota de
 * que a palavra-passe esquecida se pede a um admin) e o código da 2FA. O
 * "Esqueci-me", os avisos do link e a palavra-passe nova saíram a 20 nov 2026.
 *
 * **O cartão e os formulários são os reais** (`AuthCard` e os dois
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
    // 900 px fixos, como as outras storyboards deste canvas; o que passar faz
    // scroll dentro do ecrã. `--upm-ecra-alto` dá ao `AuthCard` a altura do
    // ecrã — sem ela, `svh` mede a moldura.
    <div
      data-theme={theme}
      style={
        {
          "--upm-ecra-alto": "900px",
          height: "900px",
          overflowY: "auto",
          background: "var(--bg)",
        } as React.CSSProperties
      }
    >
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <ThemeProvider initialChoice={theme}>
          <AuthCard>{children}</AuthCard>
        </ThemeProvider>
      </NextIntlClientProvider>
    </div>
  );
}

function Entrar({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <LoginForm onSubmit={semSubmissao} />
    </Ecra>
  );
}

export const InternoEntrarClaro = () => <Entrar theme="light" />;
export const InternoEntrarEscuro = () => <Entrar theme="dark" />;

function Verificar2fa({ theme }: { theme: "light" | "dark" }) {
  return (
    <Ecra theme={theme}>
      <ChallengeForm factorId="fator-de-exemplo" onSubmit={semSubmissao} />
    </Ecra>
  );
}

export const InternoVerificar2faClaro = () => <Verificar2fa theme="light" />;
export const InternoVerificar2faEscuro = () => <Verificar2fa theme="dark" />;
