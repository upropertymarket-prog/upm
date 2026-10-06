import type { Metadata } from "next";
import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { currentLegalDocument, isPendingLegalReview } from "@upm/db/legal";

import { LegalDocumentBody } from "../../components/legal/LegalDocumentBody";

export const metadata: Metadata = {
  title: "Termos e Condições · UProperty Market",
  // A minuta não é para ser indexada. Quando P11-07 publicar a versão revista,
  // esta linha sai e a página entra no `seo.ts` da rota, como as outras.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * Termos e Condições — `/termos` (Fase 9, P9-02)
 * =========================================================================
 * É a página que o link da caixa de aceitação abre, no registo e na
 * contratação. Lê a versão publicada de `legal_documents` — nunca um ficheiro
 * no repositório —, porque é essa a versão cujo hash fica registado na
 * aceitação.
 *
 * **Não é a página legal definitiva.** P11-07 publica as quatro páginas
 * (Termos, Privacidade, Cookies, Proteção de Dados) já revistas e ligadas entre
 * si. Esta existe porque o registo precisa de mostrar o texto hoje.
 */
export default async function TermsPage() {
  const supabase = createClient(await cookies());
  const [locale, t] = await Promise.all([getLocale(), getTranslations("legal")]);

  const document = await currentLegalDocument(supabase, "terms", locale);

  if (!document) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-16">
        <h1 className="text-xl font-semibold text-text">{t("termsTitle")}</h1>
        <p className="mt-4 text-sm text-muted">{t("unavailable")}</p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold text-text">{document.title}</h1>
        <p className="text-sm text-muted">
          {t("versionLine", {
            version: document.version,
            date: document.effectiveFrom
              ? new Date(document.effectiveFrom).toLocaleDateString(locale)
              : "—",
          })}
        </p>
        {isPendingLegalReview(document) ? (
          <p
            role="note"
            className="rounded-xl border border-border px-4 py-3 text-sm"
            style={{ background: "var(--warn-soft, var(--surface-2))" }}
          >
            {t("pendingReview")}
          </p>
        ) : null}
      </header>

      <article className="mt-8 text-sm text-text">
        <LegalDocumentBody markdown={document.bodyMd} />
      </article>
    </main>
  );
}
