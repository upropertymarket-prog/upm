import Link from "next/link";
import { BedDouble, Bath, Ruler, MapPin } from "lucide-react";
import { StatusTag } from "@upm/ui";

import type { PublicListingCard } from "../../lib/public-listings";

/**
 * Cartão de imóvel do site público (P2-05 · 04 §2.1)
 * =========================================================================
 * 04 §2.1 enumera o que o cartão mostra: "foto de capa, tag de negócio,
 * tipologia/área/WC, preço, localização aproximada". É esta lista e nada além
 * dela.
 *
 * **Separado do `PropertyCard` do Market da app, de propósito.** São duas
 * superfícies com públicos diferentes: aquele leva a `/market/{id}` dentro de
 * uma sessão e assume o shell da app; este leva a `/propriedades/{slug}` sem
 * sessão, tem de ser indexável e segue o ritmo de larguras do site (03 §1.1),
 * não o da app. Partilhar o componente obrigaria a passar o destino, o tamanho
 * da tipografia e o shell por prop — três condicionais dentro de um cartão —
 * para poupar vinte linhas de JSX.
 *
 * **A localização é a que a view dá, que é a aproximada.** `properties_public`
 * não expõe `address_line` nem a coordenada exata (08 §2.7), por isso aqui não
 * há risco de mostrar a morada de alguém: o mais preciso que existe é a
 * cidade.
 *
 * `<img>` e não `next/image`: o URL é assinado e expira, e passá-lo pelo
 * otimizador do Next obrigaria a um `remotePattern` para o domínio do Supabase
 * e a uma cache de imagens com um TTL maior do que o do próprio link — que
 * serviria imagens mortas. Com `width`/`height` declarados e `loading="lazy"`
 * não há salto de layout, que é o que o Lighthouse de 04 §2.1 AC mede.
 */

function money(cents: number | null): string {
  if (cents === null) return "Sob consulta";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function Fact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--sp-2)",
        fontSize: "var(--fs-body)",
        color: "var(--muted)",
      }}
    >
      {icon}
      {children}
    </span>
  );
}

export function ListingCard({ listing }: { listing: PublicListingCard }) {
  const price = listing.deal === "rent" ? listing.rentCents : listing.priceCents;

  return (
    <Link
      href={`/propriedades/${listing.slug}`}
      style={{
        display: "grid",
        gridTemplateRows: "auto 1fr",
        height: "100%",
        borderRadius: "var(--r-lg)",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        overflow: "hidden",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ position: "relative" }}>
        {listing.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL assinado, expira; ver a nota do ficheiro.
          <img
            src={listing.coverUrl}
            alt=""
            width={640}
            height={420}
            loading="lazy"
            decoding="async"
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              aspectRatio: "16 / 10",
              objectFit: "cover",
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              aspectRatio: "16 / 10",
              background: "var(--surface2)",
              display: "grid",
              placeItems: "center",
              color: "var(--muted)",
              fontSize: "var(--fs-body)",
            }}
          >
            sem fotografia
          </div>
        )}
        {listing.deal ? (
          <span style={{ position: "absolute", top: "var(--sp-4)", left: "var(--sp-4)" }}>
            <StatusTag tone={listing.deal === "sale" ? "dealSale" : "dealRent"}>
              {listing.deal === "sale" ? "Venda" : "Arrendamento"}
            </StatusTag>
          </span>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gap: "var(--sp-3)",
          alignContent: "start",
          padding: "var(--sp-5)",
        }}
      >
        <strong
          style={{
            fontSize: "var(--fs-subtitle)",
            color: "var(--text)",
            lineHeight: 1.3,
            // Duas linhas no máximo: um título longo não pode empurrar o preço
            // para fora do alinhamento da fila.
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {listing.title}
        </strong>

        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--fs-title-sm)",
            color: "var(--text)",
            lineHeight: 1.1,
          }}
        >
          {money(price)}
          {listing.deal === "rent" ? (
            <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)", fontWeight: 400 }}>
              {" "}
              / mês
            </span>
          ) : null}
        </span>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2) var(--sp-5)" }}>
          {listing.typology ? (
            <Fact icon={<BedDouble size={15} aria-hidden="true" />}>{listing.typology}</Fact>
          ) : null}
          {listing.grossArea ? (
            <Fact icon={<Ruler size={15} aria-hidden="true" />}>{listing.grossArea} m²</Fact>
          ) : null}
          {listing.bathrooms ? (
            <Fact icon={<Bath size={15} aria-hidden="true" />}>{listing.bathrooms} WC</Fact>
          ) : null}
        </div>

        {listing.city ? (
          <Fact icon={<MapPin size={15} aria-hidden="true" />}>{listing.city}</Fact>
        ) : null}
      </div>
    </Link>
  );
}
