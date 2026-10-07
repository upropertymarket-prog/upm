import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { currentLegalDocument, type LegalDocumentKind } from "@upm/db/legal";

import { LegalDocumentView } from "./LegalDocumentView";

/**
 * A moldura de uma página legal — `/termos`, `/privacidade`, `/cookies`.
 * =========================================================================
 * As três páginas são o mesmo ecrã com um `kind` diferente: título, linha de
 * versão, aviso de minuta quando `review_state` o diz, e o corpo em Markdown.
 * Estava escrito uma vez em `/termos`; quando P11-07 trouxe as outras duas,
 * copiá-lo era garantir que iam divergir — e são justamente as páginas em que
 * divergir importa, porque é o texto que fica registado na aceitação.
 *
 * Lê sempre de `legal_documents`, nunca de um ficheiro do repositório: a versão
 * cujo hash fica na aceitação é a que está na base de dados.
 *
 * **Nenhuma das três está revista por advogado.** O aviso não é decorativo —
 * sai de `review_state`, e desaparece sozinho quando a revisão entrar.
 */
export async function LegalDocumentPage({
  kind,
  fallbackTitleKey,
}: {
  kind: LegalDocumentKind;
  /** Título a mostrar quando não há versão publicada — chave de `legal`. */
  fallbackTitleKey: "termsTitle" | "privacyTitle" | "cookiesTitle";
}) {
  const supabase = createClient(await cookies());
  const [locale, t] = await Promise.all([getLocale(), getTranslations("legal")]);

  const document = await currentLegalDocument(supabase, kind, locale);

  if (!document) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-16">
        <h1 className="text-xl font-semibold text-text">{t(fallbackTitleKey)}</h1>
        <p className="mt-4 text-sm text-muted">{t("unavailable")}</p>
      </main>
    );
  }

  return (
    <LegalDocumentView
      title={document.title}
      versionLine={t("versionLine", {
        version: document.version,
        date: document.effectiveFrom
          ? new Date(document.effectiveFrom).toLocaleDateString(locale)
          : "—",
      })}
      markdown={document.bodyMd}
    />
  );
}
