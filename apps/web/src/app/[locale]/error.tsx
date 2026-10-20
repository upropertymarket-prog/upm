"use client";

import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { SectionHeading, SiteSection } from "@/components/site/SiteSection";

/**
 * Erro não tratado do site público (P2-05)
 * =========================================================================
 * Irmão do `not-found.tsx`, e escrito a seguir a ele pela mesma razão: sem
 * ficheiro, o Next serve o seu ecrã por omissão — em inglês, sem marca nenhuma.
 *
 * **Sem `PublicHeader` nem `SiteFooter`, ao contrário do 404, e é deliberado.**
 * Um `error.tsx` é obrigatoriamente um Client Component, e os dois recebem
 * `setLocalePreference`, que é uma Server Action que a página passa. Aqui não
 * há página: este ecrã substitui a que rebentou. Pior — se o erro vier do
 * próprio cabeçalho, desenhá-lo outra vez rebenta o limite também. A navegação
 * fica nos dois botões, que é o que não pode falhar.
 *
 * Não se mostra `error.message`: em produção o Next já o substitui por uma
 * mensagem genérica, e mostrá-lo seria dar a quem passa um detalhe interno sem
 * lhe resolver nada. O `digest` é a ponte para os registos e esse sim aparece,
 * em letra pequena, para quem reportar o problema o poder citar.
 */
export default function SiteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("site.error");

  return (
    <main>
      <SiteSection>
        <div style={{ display: "grid", gap: "var(--sp-6)", justifyItems: "center" }}>
          <SectionHeading
            eyebrow={t("eyebrow")}
            title={t("heading")}
            body={t("body")}
            align="center"
          />
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--sp-4)",
              justifyContent: "center",
            }}
          >
            <button type="button" onClick={reset} className="upm-btn upm-btn--primary upm-btn--md">
              {t("retry")}
            </button>
            <Link href="/" className="upm-btn upm-btn--secondary upm-btn--md">
              {t("home")}
            </Link>
          </div>
          {error.digest ? (
            <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
              {t("reference", { digest: error.digest })}
            </span>
          ) : null}
        </div>
      </SiteSection>
    </main>
  );
}
