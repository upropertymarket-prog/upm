import { cookies } from "next/headers";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { currentLegalDocument, type LegalDocumentKind } from "@upm/db/legal";

import { getLaunchMode } from "../../lib/launch-mode";
import { PublicHeader } from "../PublicHeader";
import { SiteFooter } from "../site/SiteFooter";
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
 *
 * **12 out 2026 — passou a ter a barra e o rodapé do site público.** As três
 * rotas serviam o documento sozinho, sem nada à volta: quem chegava ao fim dos
 * Termos não tinha forma de voltar ao site, e quem lá chegava por link não via
 * de que site se tratava. São páginas do `www` como `/propriedades` ou `/`, e levam
 * a mesma moldura.
 *
 * O menu vem com as secções do site, apontadas à home (`/#precos`): a primeira
 * versão trazia só a marca e o botão, e uma barra sem links não é navegação —
 * quem abre os Termos a partir de um e-mail ficava sem forma de chegar a
 * Preços ou a Contactos. O `PublicHeader` resolve-o com `anchors`, que escolhe
 * o destino em vez de esconder o menu.
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
  const [locale, t, launchMode] = await Promise.all([
    getLocale(),
    getTranslations("legal"),
    getLaunchMode(),
  ]);

  const document = await currentLegalDocument(supabase, kind, locale);

  const chrome = (conteudo: React.ReactNode) => (
    <>
      <PublicHeader locale={locale} launchMode={launchMode} />
      {conteudo}
      <SiteFooter />
    </>
  );

  if (!document) {
    return chrome(
      <main className="mx-auto w-full max-w-3xl px-4 py-16">
        <h1 className="text-xl font-semibold text-text">{t(fallbackTitleKey)}</h1>
        <p className="mt-4 text-sm text-muted">{t("unavailable")}</p>
      </main>,
    );
  }

  return chrome(
    <LegalDocumentView
      title={document.title}
      versionLine={t("versionLine", {
        version: document.version,
        date: document.effectiveFrom
          ? new Date(document.effectiveFrom).toLocaleDateString(locale)
          : "—",
      })}
      markdown={document.bodyMd}
    />,
  );
}
