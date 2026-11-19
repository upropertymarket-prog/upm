import type { Route } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { BarChart3, Eye, SquarePen } from "lucide-react";
import { Card, CardBody, StatusTag } from "@upm/ui";

import { PROPERTY_STATUS_TONE, type PropertyRow } from "../my-properties/PropertyListing";

export type OwnerListingBarProps = {
  /** Só chegam aqui `active` e `featured`: `properties_public` filtra o resto. */
  status: PropertyRow["status"];
  viewsCount: number | null;
  editHref: string;
  statsHref: string;
};

/**
 * Barra de gestão do próprio anúncio — `/market/[id]` (07 §22)
 * =========================================================================
 * 04 §8.3 diz que o Market do proprietário é igual ao do comprador, e assim
 * fica: a ficha por baixo desta barra é exatamente a que um comprador vê. O
 * que 04 não previa é o proprietário abrir o **seu próprio** anúncio, e aí a
 * página não dizia que o anúncio era dele, não mostrava estado nem uso, e não
 * lhe dava onde agir — limitava-se a esconder "Contactar" e "Pedir visita".
 *
 * Por isso uma faixa por cima, e não um ecrã à parte: duplicar a ficha para
 * ganhar três atalhos deixaria duas versões da mesma página a divergir. Pela
 * mesma razão não há "ver como comprador": o que está por baixo já é a vista
 * do comprador.
 */
export function OwnerListingBar({ status, viewsCount, editHref, statsHref }: OwnerListingBarProps) {
  const t = useTranslations("market.owner");
  const ts = useTranslations("property.status");

  return (
    <Card>
      <CardBody
        style={{
          display: "flex",
          // `.upm-card__body` empilha por omissão; aqui é uma faixa.
          flexDirection: "row",
          alignItems: "center",
          gap: "var(--sp-5)",
          flexWrap: "wrap",
        }}
      >
        <strong style={{ fontSize: "var(--fs-body-lg)" }}>{t("yourListing")}</strong>
        <StatusTag tone={PROPERTY_STATUS_TONE[status]}>{ts(status)}</StatusTag>
        {viewsCount !== null ? (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--sp-2)",
              color: "var(--muted)",
              fontSize: "var(--fs-body)",
            }}
          >
            <Eye size={15} aria-hidden="true" />
            {t("views", { count: viewsCount })}
          </span>
        ) : null}
        <span style={{ display: "flex", gap: "var(--sp-4)", marginLeft: "auto" }}>
          <Link
            href={statsHref as Route}
            className="upm-btn upm-btn--secondary upm-btn--sm"
            style={{ textDecoration: "none" }}
          >
            <BarChart3 size={15} aria-hidden="true" />
            {t("stats")}
          </Link>
          <Link
            href={editHref as Route}
            className="upm-btn upm-btn--secondary upm-btn--sm"
            style={{ textDecoration: "none" }}
          >
            <SquarePen size={15} aria-hidden="true" />
            {t("edit")}
          </Link>
        </span>
      </CardBody>
    </Card>
  );
}
