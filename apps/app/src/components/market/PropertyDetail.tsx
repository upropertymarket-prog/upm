import Image from "next/image";
import Link from "next/link";
import { Bath, BedDouble, CalendarDays, Layers, Ruler, Zap } from "lucide-react";
import { Card, CardBody, StatusTag } from "@upm/ui";

import { PropertyLocationMap } from "../map/PropertyLocationMap";

/**
 * Detalhe de imóvel — `/market/[id]` (04 §8.2)
 * =========================================================================
 * A ficha inteira: galeria, cabeçalho, factos, descrição, mapa aproximado e a
 * barra de contacto. **Sem Supabase e sem `next/headers`** — tudo entra por
 * prop, que é o que permite a storyboard do canvas montar este mesmo ecrã com
 * dados fixos em vez de o reconstruir.
 *
 * Era isto que faltava quando as storyboards do Proprietário foram removidas na
 * Fase 4 (ver o doc "Registo — storyboards do Proprietário removidas"): a
 * página tinha a UI toda escrita lá dentro, por isso a única maneira de a
 * mostrar no canvas era copiá-la — e uma cópia deixa de dizer a verdade sobre
 * o produto assim que a página muda.
 *
 * `actions` é um buraco de propósito: guardar e contactar são Server Actions,
 * que vivem na página. Aqui só se reserva o lugar onde eles entram.
 */

export type PropertyDetailData = {
  ref: string | null;
  title: string | null;
  typology: string | null;
  city: string | null;
  district: string | null;
  description: string | null;
  grossArea: number | null;
  bathrooms: number | null;
  floor: string | null;
  yearBuilt: number | null;
  energyCert: string | null;
  deal: "sale" | "rent" | null;
};

export type PropertyDetailLocation = {
  lon: number;
  lat: number;
  isExact: boolean;
  radiusM: number;
};

export type PropertyDetailProps = {
  property: PropertyDetailData;
  /** URLs já assinados pela página; o primeiro é a capa. */
  photos: string[];
  /** `null` enquanto o imóvel não tiver ponto — o cartão do mapa desaparece. */
  location: PropertyDetailLocation | null;
  /** Preço já formatado: é a página que sabe se é venda ou arrendamento. */
  price: string;
  ownerName: string;
  /** Guardar + contactar. A página passa os Server Actions; o canvas, fixos. */
  actions?: React.ReactNode;
};

export function PropertyDetail({
  property,
  photos,
  location,
  price,
  ownerName,
  actions,
}: PropertyDetailProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <Link
        href="/market"
        className="upm-btn upm-btn--secondary upm-btn--sm"
        style={{ alignSelf: "flex-start", textDecoration: "none" }}
      >
        ← Voltar ao Market
      </Link>
      {/* Ficha + barra de contacto. Abaixo de 900 px empilham (`.upm-split`),
          com a barra a seguir às fotografias em vez de espremida ao lado. */}
      <div
        className="upm-split"
        style={
          {
            "--split-cols": "minmax(0, 1fr) minmax(280px, 360px)",
            "--split-gap": "28px",
          } as React.CSSProperties
        }
      >
        <main style={{ display: "flex", flexDirection: "column", gap: 24, minWidth: 0 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 3fr) minmax(84px, 1fr)",
              gap: 8,
              /* Altura fluida: 360 px é a medida do desenho em ecrã largo,
                 mas no telemóvel deixava a foto principal quase quadrada e
                 as miniaturas com 110 px a comerem um terço da largura. */
              height: "clamp(220px, 46vw, 360px)",
            }}
          >
            {photos[0] ? (
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "100%",
                  overflow: "hidden",
                  borderRadius: 16,
                }}
              >
                <Image
                  src={photos[0]}
                  alt=""
                  fill
                  unoptimized
                  sizes="(max-width: 900px) 100vw, 70vw"
                  style={{ objectFit: "cover" }}
                />
              </div>
            ) : (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  borderRadius: 16,
                  background: "var(--surface2)",
                }}
              />
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
              {photos.slice(1, 4).map((url) => (
                <div
                  key={url}
                  style={{
                    position: "relative",
                    flex: 1,
                    minHeight: 0,
                    overflow: "hidden",
                    borderRadius: 10,
                  }}
                >
                  <Image
                    src={url}
                    alt=""
                    fill
                    unoptimized
                    sizes="120px"
                    style={{ objectFit: "cover" }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ color: "var(--muted)", fontSize: 12 }}>Ref. {property.ref}</span>
            <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>{property.title}</h1>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              ⌖ {[property.typology, property.city, property.district].filter(Boolean).join(" · ")}
            </p>
          </div>
          <dl
            style={{
              display: "grid",
              /* 3 × 2 em ecrã largo, como o desenho original (ver o registo das
                 storyboards removidas). Os 220 px é que o garantem: com a
                 coluna a ~745 px cabem três e não quatro — e em ecrã estreito
                 caem para duas e depois uma, sem media query. */
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
              gap: 12,
              margin: 0,
            }}
          >
            <Detail
              icon={<BedDouble {...DETAIL_ICON} />}
              label="Tipologia"
              value={property.typology}
            />
            <Detail
              icon={<Ruler {...DETAIL_ICON} />}
              label="Área bruta"
              value={property.grossArea ? `${property.grossArea} m²` : null}
            />
            <Detail
              icon={<Bath {...DETAIL_ICON} />}
              label="Casas de banho"
              value={property.bathrooms?.toString() ?? null}
            />
            <Detail icon={<Layers {...DETAIL_ICON} />} label="Piso" value={property.floor} />
            <Detail
              icon={<CalendarDays {...DETAIL_ICON} />}
              label="Ano de construção"
              value={property.yearBuilt?.toString() ?? null}
            />
            <Detail
              icon={<Zap {...DETAIL_ICON} />}
              label="Certificado energético"
              value={property.energyCert}
            />
          </dl>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>Descrição do proprietário</h2>
            <p style={{ margin: 0, lineHeight: 1.75, color: "var(--muted)" }}>
              {property.description}
            </p>
          </div>
          {location ? (
            <Card>
              <CardBody style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong>Localização aproximada</strong>
                  <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12 }}>
                    morada exata após contacto
                  </span>
                </div>
                <PropertyLocationMap
                  lon={location.lon}
                  lat={location.lat}
                  isExact={location.isExact}
                  radiusM={location.radiusM}
                />
              </CardBody>
            </Card>
          ) : null}
        </main>
        {/* `--sticky` só cola acima de 900 px: empilhada, uma barra presa ao
            topo tapava o conteúdo que devia vir a seguir. */}
        <aside
          className="upm-split__aside upm-split__aside--sticky"
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <Card>
            <CardBody style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {property.deal ? (
                <StatusTag tone={property.deal === "sale" ? "dealSale" : "dealRent"}>
                  {property.deal === "sale" ? "Venda" : "Arrendamento"}
                </StatusTag>
              ) : null}
              <strong style={{ fontSize: 30 }}>{price}</strong>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <strong>{ownerName}</strong>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>Responde em ~2 h</div>
              </div>
              {actions}
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

/** Os ícones dos factos são todos iguais: neutros, do tamanho do rótulo. */
const DETAIL_ICON = { size: 15, "aria-hidden": true, style: { flexShrink: 0 } } as const;

function Detail({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 14,
        background: "var(--surface)",
      }}
    >
      <dt
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          color: "var(--muted)",
          fontSize: 12,
        }}
      >
        {icon}
        {label}
      </dt>
      <dd style={{ margin: "4px 0 0", fontWeight: 700 }}>{value}</dd>
    </div>
  );
}
