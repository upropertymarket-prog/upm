import { LegalDocumentBody } from "./LegalDocumentBody";

/**
 * A vista de um documento legal — título, versão, aviso e corpo.
 * =========================================================================
 * Separada de `LegalDocumentPage` porque essa é `async`, lê `next/headers` e
 * fala com a base de dados: nada disso corre dentro de uma storyboard. Sem esta
 * separação o canvas teria de **reconstruir** a página, e era só uma questão de
 * tempo até o `py-16` de um lado deixar de ser o do outro — o mesmo erro que o
 * `AuthShell` já tinha corrigido nos ecrãs de autenticação.
 *
 * Assim há uma marcação só: a página serve-a com dados da base de dados, o
 * canvas serve-a com um excerto fixo, e as duas são literalmente o mesmo
 * componente.
 *
 * Recebe texto já traduzido em vez de chamar `useTranslations`, para servir
 * tanto o lado servidor (`getTranslations`) como o canvas (fixtures).
 *
 * **7 out 2026 — o aviso de minuta deixou de ser desenhado aqui.** Havia uma
 * faixa `role="note"` com `legal.pendingReview` por cima do corpo, e o corpo das
 * quatro minutas **abre com a mesma advertência**, em citação. Era a mesma frase
 * duas vezes seguidas, e o cliente pediu para tirar uma.
 *
 * O que ficou é a do próprio documento — a certa: P9-02 exige que a interface
 * diga que o texto é minuta, e essa exigência continua cumprida porque a
 * advertência faz parte do texto que a pessoa aceita e cujo hash fica
 * registado. A faixa era decoração por cima dela.
 *
 * O prop que a desenhava saiu da assinatura em vez de ficar sem uso: um prop que
 * ninguém lê é a próxima pessoa a perguntar porque é que não faz nada.
 */
export function LegalDocumentView({
  title,
  versionLine,
  markdown,
}: {
  title: string;
  versionLine: string;
  markdown: string;
}) {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <header className="flex flex-col gap-2">
        {/* Os mesmos tokens do título de página do shell (`--fs-title`,
            `--fw-bold`, `--font-display`), para o H1 destes documentos ter o
            peso dos restantes títulos da app. Antes era `text-xl font-semibold`
            e lia-se como um subtítulo. */}
        <h1
          className="text-text"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-title)",
            fontWeight: "var(--fw-bold)",
            lineHeight: "var(--lh-tight)",
            letterSpacing: "var(--ls-title)",
            margin: 0,
          }}
        >
          {title}
        </h1>
        <p className="text-sm text-muted">{versionLine}</p>
      </header>

      <article className="mt-8 text-sm text-text">
        <LegalDocumentBody markdown={markdown} />
      </article>
    </main>
  );
}
