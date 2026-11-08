/**
 * O cartão dos ecrãs de entrada do interno (8 nov 2026)
 * =========================================================================
 * Entrar, "Esqueci-me", palavra-passe nova e código da 2FA: um cartão
 * centrado, sem o cromado da área interna — quem lá está ainda não entrou.
 * Estava repetido em quatro `page.tsx`; saiu para aqui para as storyboards
 * desenharem o mesmo cartão que a página, em vez de uma cópia.
 */
export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        {children}
      </div>
    </main>
  );
}
