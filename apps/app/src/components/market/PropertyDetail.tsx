import Link from "next/link";
import { useTranslations } from "next-intl";
import { Bath, BedDouble, CalendarDays, Layers, Ruler, Zap } from "lucide-react";
import { Card, CardBody, StatusTag } from "@upm/ui";

import { PropertyLocationMap } from "../map/PropertyLocationMap";
import { PropertyCard, type PropertyCardData } from "./PropertyCard";

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
 *
 * ---------------------------------------------------------------------------
 * A GALERIA USA `<img>` E NÃO `next/image` (22 out 2026)
 * ---------------------------------------------------------------------------
 * As duas chamadas que aqui estavam passavam **`unoptimized`**, e não há bloco
 * `images` no `next.config.ts`. Ou seja: o otimizador já estava desligado, e o
 * `next/image` só servia de atalho de layout — `fill` para preencher o
 * contentor e `objectFit` por `style`. Não dava nada que um `<img>` posicionado
 * não dê, e o `sizes` que acompanhava só conta para o `srcset` que o otimizador
 * desligado nunca gerou.
 *
 * O que dava era um defeito, e grande: `next/image` lê `process` no topo do seu
 * módulo de cliente. No canvas — host **Vite**, sem compilador do Next — isso
 * corre a sério e atira `ReferenceError: process is not defined`. Como o
 * `index.canvas.tsx` importa todas as storyboards do canvas, um único módulo
 * assim deixava em branco **as 24 storyboards do `06 - proprietario`**, não só
 * as duas do Detalhe. Medido no host: `06/Painel` ficava com 17 elementos e
 * zero texto, e o erro nem aparecia na consola — o host engole-o na fronteira
 * de erro do import.
 *
 * Foi este o último dos quatro sintomas da passagem do sidecar a Vite, e o
 * único que não tinha nada a ver com Server Actions nem com o router.
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
  /**
   * Barra de gestão, só quando quem vê é o dono do anúncio (`OwnerListingBar`).
   * Fica por cima da ficha e não lhe toca: o que está por baixo continua a ser,
   * à letra, o que um comprador vê (04 §2.3).
   */
  management?: React.ReactNode;
  /** Mesmo negócio e mesma cidade, sem este imóvel. Vazio esconde a secção. */
  similar?: PropertyCardData[];
  /** Outros anúncios do mesmo proprietário. Vazio esconde a secção. */
  fromOwner?: PropertyCardData[];
  /**
   * O anúncio seguinte na ordem do Market (04 §8.4 · D44). `null` no último da
   * lista — e então o bloco não se desenha, em vez de ficar uma seta morta.
   */
  nextListing?: { id: string; title: string } | null;
};

export function PropertyDetail({
  property,
  photos,
  location,
  price,
  ownerName,
  actions,
  management,
  similar = [],
  fromOwner = [],
  nextListing = null,
}: PropertyDetailProps) {
  const t = useTranslations("market");
  // Os rótulos dos factos são o vocabulário do imóvel, não deste ecrã: vivem em
  // `property.fields` e são os mesmos que a moderação do Admin lê.
  const tf = useTranslations("property");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <Link
        href="/market"
        className="upm-btn upm-btn--secondary upm-btn--sm"
        style={{ alignSelf: "flex-start", textDecoration: "none" }}
      >
        <span aria-hidden="true">←</span> {t("back")}
      </Link>
      {management}
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
                {/* `fill` do next/image era isto: absoluto a preencher o
                    contentor, que já é `position: relative`. */}
                {/* eslint-disable-next-line @next/next/no-img-element --
                    o `next/image` daqui passava `unoptimized`: o aviso recomenda
                    uma otimização que nunca esteve ligada. Ver a nota de topo. */}
                <img
                  src={photos[0]}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  style={{
                    position: "absolute",
                    inset: 0,
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
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
                  {/* eslint-disable-next-line @next/next/no-img-element --
                    o `next/image` daqui passava `unoptimized`: o aviso recomenda
                    uma otimização que nunca esteve ligada. Ver a nota de topo. */}
                  <img
                    src={url}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ color: "var(--muted)", fontSize: "var(--fs-body)" }}>
              {t("ref", { ref: property.ref ?? "" })}
            </span>
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
              label={tf("fields.typology")}
              value={property.typology}
            />
            <Detail
              icon={<Ruler {...DETAIL_ICON} />}
              label={tf("fields.grossArea")}
              value={property.grossArea ? t("area", { value: property.grossArea }) : null}
            />
            <Detail
              icon={<Bath {...DETAIL_ICON} />}
              label={tf("fields.bathrooms")}
              value={property.bathrooms?.toString() ?? null}
            />
            <Detail
              icon={<Layers {...DETAIL_ICON} />}
              label={tf("fields.floor")}
              value={property.floor}
            />
            <Detail
              icon={<CalendarDays {...DETAIL_ICON} />}
              label={tf("fields.yearBuilt")}
              value={property.yearBuilt?.toString() ?? null}
            />
            <Detail
              icon={<Zap {...DETAIL_ICON} />}
              label={tf("fields.energyCert")}
              value={property.energyCert}
            />
          </dl>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 17 }}>{t("ownerDescription")}</h2>
            <p style={{ margin: 0, lineHeight: 1.75, color: "var(--muted)" }}>
              {property.description}
            </p>
          </div>
          {location ? (
            <Card>
              <CardBody style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong>{t("approxLocation")}</strong>
                  <span
                    style={{
                      marginLeft: "auto",
                      color: "var(--muted)",
                      fontSize: "var(--fs-body)",
                    }}
                  >
                    {t("addressAfterContact")}
                  </span>
                </div>
                <PropertyLocationMap
                  lon={location.lon}
                  lat={location.lat}
                  isExact={location.isExact}
                  radiusM={location.radiusM}
                  /* O mapa é o que situa o imóvel; a 220 px mal se via a rua.
                     `clamp` em vez de uma altura fixa para não repetir D32. */
                  style={{ height: "clamp(280px, 38vw, 460px)" }}
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
            <CardBody
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 18,
                // As ações encostam à base com 16 px, não com os 20 px do
                // enchimento geral do cartão.
                paddingBottom: 16,
              }}
            >
              {property.deal ? (
                <StatusTag tone={property.deal === "sale" ? "dealSale" : "dealRent"}>
                  {tf(`deal.${property.deal}`)}
                </StatusTag>
              ) : null}
              <strong style={{ fontSize: 30 }}>{price}</strong>
              <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <strong>{ownerName}</strong>
                <div style={{ color: "var(--muted)", fontSize: "var(--fs-body)" }}>
                  {t("respondsIn")}
                </div>
              </div>
              {/* As ações num bloco só, encostado à base do cartão: 16 px entre
                  elas e 16 px até à borda, em vez do espaçamento geral do
                  `CardBody`. O resto do cartão mantém o seu ritmo. */}
              {actions ? <div style={{ display: "grid", gap: 16 }}>{actions}</div> : null}
            </CardBody>
          </Card>
          {/* "Anúncio seguinte" (04 §8.4 · fecha D44): continuar a ver sem
              voltar à lista. Segue a ordem do Market — o mais recente primeiro
              — e no último anúncio não aparece. */}
          {nextListing ? (
            <Card>
              <CardBody style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ color: "var(--muted)", fontSize: "var(--fs-body)" }}>
                  {t("nextListing")}
                </span>
                <Link
                  href={`/market/${nextListing.id}`}
                  style={{
                    color: "var(--text)",
                    fontWeight: "var(--fw-semibold)",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ minWidth: 0 }}>{nextListing.title}</span>
                  <span aria-hidden="true">→</span>
                </Link>
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>

      {/* Fora do `.upm-split`, e não dentro da coluna da ficha: estas faixas
          são o rodapé da página, não parte do imóvel. Ganham a largura toda,
          que é o que deixa caber quatro cartões sem os espremer. */}
      <ListingSection title={t("similar")} items={similar} />
      <ListingSection title={t("moreFromOwner", { owner: ownerName })} items={fromOwner} />
    </div>
  );
}

/**
 * Uma faixa de cartões do Market com título. Sem itens não se desenha nada —
 * um "Anúncios semelhantes" vazio é pior do que a secção não existir.
 */
function ListingSection({ title, items }: { title: string; items: PropertyCardData[] }) {
  if (items.length === 0) return null;
  return (
    <section
      className="upm-listing-section"
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
    >
      <h2 style={{ margin: 0, fontSize: 17 }}>{title}</h2>
      <div className="upm-listing-grid">
        {items.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
    </section>
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
          fontSize: "var(--fs-body)",
        }}
      >
        {icon}
        {label}
      </dt>
      <dd style={{ margin: "4px 0 0", fontWeight: "var(--fw-semibold)" }}>{value}</dd>
    </div>
  );
}
