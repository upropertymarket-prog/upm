import Link from "next/link";
import type { Route } from "next";
import { Brand } from "@upm/ui";

/**
 * Invólucro dos ecrãs de autenticação (Fase 3 · 03 F2, F3)
 * =========================================================================
 * As páginas de auth — entrar, criar conta, verificação, pedir recuperação e
 * definir nova palavra-passe — partilhavam o mesmo `<main>` e o mesmo cartão,
 * copiados ficheiro a ficheiro. Estavam copiados uma sexta vez dentro do
 * canvas, o que fazia as storyboards mostrar uma reconstrução em vez da página
 * real: bastava um `py-16` virar `py-10` para o canvas deixar de dizer a
 * verdade sobre o produto.
 *
 * Passa a existir aqui uma vez só. O canvas importa estes mesmos componentes.
 *
 * **7 out 2026 — o que mudou e porquê.** O cliente, ao tentar rever os ecrãs:
 * *"páginas que só contêm um form, sem nada mais, é estranho — uma página de
 * sign-in sem um link para a página criar conta é estranho"*. Tinha razão
 * quanto ao enquadramento: o cartão aparecia sozinho no meio do ecrã, sem
 * marca, sem subtítulo e sem saída para o resto do site. O `AuthShell` abaixo
 * é a moldura que faltava — wordmark, título, subtítulo, a troca entre entrar e
 * criar conta, e o rodapé legal — e é a MESMA em todas as páginas.
 */

/** Larguras dos cartões de auth, medidas nas páginas originais. */
const WIDTHS = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
} as const;

export type AuthCardWidth = keyof typeof WIDTHS;

/** Fundo a toda a altura do ecrã, com o conteúdo centrado. */
export function AuthPage({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
      {children}
    </main>
  );
}

/**
 * O cartão branco. `relative` porque o honeypot do `LoginForm` é
 * `absolute -left-[9999px]` e precisa de um pai posicionado para não escapar
 * do fluxo. `centered` só na verificação, onde o texto é uma mensagem.
 */
export function AuthCard({
  width = "sm",
  centered = false,
  children,
}: {
  width?: AuthCardWidth;
  centered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`relative mx-auto flex w-full ${WIDTHS[width]} flex-col gap-4 rounded-2xl border border-border bg-surface p-6${
        centered ? " text-center" : ""
      }`}
    >
      {children}
    </div>
  );
}

/** Título do cartão — o mesmo tamanho e peso nas páginas. */
export function AuthTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="text-lg font-semibold text-text">{children}</h1>;
}

/** Subtítulo: uma linha a dizer para que serve o ecrã. */
export function AuthSubtitle({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted">{children}</p>;
}

export type AuthShellProps = {
  width?: AuthCardWidth;
  /** Título do ecrã. Omitido quando o próprio formulário já o desenha. */
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** A linha de troca abaixo do cartão: "Ainda não tem conta? Criar conta". */
  switchPrompt?: React.ReactNode;
  /** `typedRoutes` do Next: uma rota conhecida, não uma string qualquer. */
  switchHref?: Route;
  switchLabel?: React.ReactNode;
  /** Texto do link legal no rodapé — os Termos, que já existem em `/termos`. */
  legalLabel: React.ReactNode;
  children: React.ReactNode;
};

/**
 * A página de autenticação completa: marca, cartão, troca e rodapé.
 *
 * O rodapé liga **só ao que existe**. A Política de Privacidade, a de Cookies e
 * a de Proteção de Dados são P11-07 e ainda não têm página — pôr links mortos
 * aqui era pior do que não os pôr. Quando essas páginas existirem, entram nesta
 * lista e em mais nenhum sítio.
 */
export function AuthShell({
  width = "sm",
  title,
  subtitle,
  switchPrompt,
  switchHref,
  switchLabel,
  legalLabel,
  children,
}: AuthShellProps) {
  return (
    <AuthPage>
      <div className={`mx-auto flex w-full ${WIDTHS[width]} flex-col items-stretch gap-6`}>
        {/* O wordmark leva ao site público: é a saída de quem chegou aqui por
            engano. `Brand` é o componente do design system — nunca uma cópia do
            logótipo (07 §10.1). */}
        <Link href="/" className="mx-auto" aria-label="UProperty Market">
          <Brand />
        </Link>

        <AuthCard width={width}>
          {title ? <AuthTitle>{title}</AuthTitle> : null}
          {subtitle ? <AuthSubtitle>{subtitle}</AuthSubtitle> : null}
          {children}
        </AuthCard>

        {switchPrompt && switchHref && switchLabel ? (
          <p className="text-center text-sm text-muted">
            {switchPrompt}{" "}
            <Link href={switchHref} className="text-accent hover:underline">
              {switchLabel}
            </Link>
          </p>
        ) : null}

        <footer className="text-center text-sm text-muted">
          <Link href="/termos" className="hover:underline">
            {legalLabel}
          </Link>
        </footer>
      </div>
    </AuthPage>
  );
}
