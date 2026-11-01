import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@upm/ui";

/**
 * 404 da app autenticada (12 §12.2)
 * =========================================================================
 * Sem este ficheiro, o Next serve o seu ecrã por omissão: fundo branco,
 * "404 | This page could not be found", em inglês, sem saída nenhuma. É o que
 * via quem abrisse um link antigo para uma propriedade entretanto arquivada —
 * dentro da app pela qual está a pagar.
 *
 * É o gémeo do `not-found.tsx` do `www` (P2-05), com a diferença que conta
 * aqui: quem cai neste tem sessão, por isso a saída é o início da app e não a
 * home pública.
 *
 * O `<Link>` é o do Next e não o do `@/i18n/navigation`: esta app não tem
 * segmento de idioma nas rotas — o idioma vem do cookie — e o roteador
 * localizado do `next-intl` não se aplica.
 */
export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <div
      style={{ display: "grid", placeItems: "center", minHeight: "60vh", padding: "var(--sp-6)" }}
    >
      <EmptyState
        title={t("notFoundTitle")}
        description={t("notFoundBody")}
        action={
          // As classes no próprio `<Link>` e não um `<Button>` à volta: é o
          // padrão desta base (ver `conta-suspensa/page.tsx` e `guardados`), e
          // é o correto — quem navega precisa de uma âncora, não de um botão.
          <Link className="upm-btn upm-btn--primary upm-btn--md" href="/">
            {t("backToStart")}
          </Link>
        }
      />
    </div>
  );
}
