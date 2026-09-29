/**
 * Invólucro dos ecrãs de autenticação (Fase 3 · 03 F2, F3)
 * =========================================================================
 * As seis páginas de auth — entrar, criar conta, verificação, plano, pedir
 * recuperação e definir nova palavra-passe — partilhavam o mesmo `<main>` e o
 * mesmo cartão, copiados ficheiro a ficheiro. Estavam copiados uma sétima vez
 * dentro do canvas, o que fazia as storyboards mostrar uma reconstrução em vez
 * da página real: bastava um `py-16` virar `py-10` para o canvas deixar de
 * dizer a verdade sobre o produto.
 *
 * Passa a existir aqui uma vez só. O canvas importa estes mesmos componentes.
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

/** Título do cartão — o mesmo tamanho e peso nas seis páginas. */
export function AuthTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="text-lg font-semibold text-text">{children}</h1>;
}
