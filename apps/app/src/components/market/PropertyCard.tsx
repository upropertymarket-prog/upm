import type { Route } from "next";
import Link from "next/link";
import { Card, CardBody, StatusTag } from "@upm/ui";

import { formatCents } from "../../lib/money";

export type PropertyCardData = {
  id: string;
  title: string | null;
  deal: "sale" | "rent" | null;
  typology: string | null;
  city: string | null;
  price_cents: number | null;
  rent_cents: number | null;
  coverUrl: string | null;
};

/**
 * Cartão de imóvel do Market (P4-04a). A `coverUrl` (signed URL) já vem
 * calculada do Server Component pai — nunca se gera dentro de um client
 * component.
 */
export function PropertyCard({ property }: { property: PropertyCardData }) {
  return (
    /* `height: 100%` nos dois níveis: a grelha estica o `<a>` à altura da fila,
       mas sem isto o cartão ficava pela sua própria altura e os cartões da
       mesma fila acabavam desalinhados em baixo. */
    <Link
      href={`/market/${property.id}` as Route}
      style={{ display: "block", height: "100%", textDecoration: "none" }}
    >
      <Card interactive style={{ height: "100%" }}>
        {/* O tag de negócio sai do fluxo e vai para cima da imagem: na linha do
            título, "Arrendamento" roubava-lhe muito mais largura do que "Venda"
            e cada cartão quebrava o título num sítio diferente. */}
        <div style={{ position: "relative" }}>
          {property.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed URL, expira.
            <img
              src={property.coverUrl}
              alt=""
              style={{
                display: "block",
                width: "100%",
                height: 160,
                objectFit: "cover",
                borderRadius: "16px 16px 0 0",
              }}
            />
          ) : (
            <div
              aria-hidden="true"
              style={{
                width: "100%",
                height: 160,
                borderRadius: "16px 16px 0 0",
                background: "var(--surface-muted, #eee)",
              }}
            />
          )}
          {property.deal ? (
            <span
              style={{
                position: "absolute",
                top: "var(--sp-5)",
                right: "var(--sp-5)",
              }}
            >
              <StatusTag tone={property.deal === "sale" ? "dealSale" : "dealRent"}>
                {property.deal === "sale" ? "Venda" : "Arrendamento"}
              </StatusTag>
            </span>
          ) : null}
        </div>
        <CardBody>
          <strong>{property.title ?? "(sem título)"}</strong>
          <p>{formatCents(property.price_cents ?? property.rent_cents)}</p>
          <p style={{ color: "var(--muted)" }}>
            {[property.typology, property.city].filter(Boolean).join(" · ")}
          </p>
        </CardBody>
      </Card>
    </Link>
  );
}
