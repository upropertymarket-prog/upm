import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@upm/ui";

/**
 * 404 do `interno` (12 §12.2)
 * =========================================================================
 * Quem cai aqui é da equipa, quase sempre por um link antigo guardado nos
 * favoritos de uma área que mudou de sítio — e isso aconteceu: o `/marketing`
 * nasceu a 14 out 2026 e levou rotas que antes viviam no Suporte.
 *
 * A saída é a raiz, que encaminha pelo papel. Para o Marketing, que **não** é
 * staff, qualquer destino fixo dentro de `/admin` seria uma parede.
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
          <Link className="upm-btn upm-btn--primary upm-btn--md" href="/">
            {t("backToStart")}
          </Link>
        }
      />
    </div>
  );
}
