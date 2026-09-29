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
    <a href={`/market/${property.id}`} style={{ display: "block", textDecoration: "none" }}>
      <Card interactive>
        {property.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL, expira.
          <img
            src={property.coverUrl}
            alt=""
            style={{
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
        <CardBody>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <strong>{property.title ?? "(sem título)"}</strong>
            {property.deal ? (
              <StatusTag tone={property.deal === "sale" ? "dealSale" : "dealRent"}>
                {property.deal === "sale" ? "Venda" : "Arrendamento"}
              </StatusTag>
            ) : null}
          </div>
          <p>{formatCents(property.price_cents ?? property.rent_cents)}</p>
          <p style={{ color: "var(--muted)" }}>
            {[property.typology, property.city].filter(Boolean).join(" · ")}
          </p>
        </CardBody>
      </Card>
    </a>
  );
}
