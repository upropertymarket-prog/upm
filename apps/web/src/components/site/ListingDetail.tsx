import Link from "next/link";

import { PublicHeader } from "../PublicHeader";
import { ListingGallery } from "./ListingGallery";
import { ListingMap } from "./ListingMap";
import { SiteSection } from "./SiteSection";
import { SiteFooter } from "./SiteFooter";
import type { PublicListingDetail } from "../../lib/public-listings";

/**
 * A ficha de um imóvel, sem ir buscar nada (P2-05)
 * =========================================================================
 * Separado da `page.tsx` pela mesma razão que o `HomeSections`: a página é um
 * Server Component assíncrono que resolve o slug, lê `properties_public` e
 * redireciona — e nada disso corre dentro de uma storyboard. Com o corte, o que
 * desenha recebe o imóvel por prop e pode ser **visto no canvas**, nos dois
 * temas, sem tocar na base de dados.
 *
 * O corte é certo por si só, canvas à parte: a página passa a ter uma camada
 * que busca e outra que desenha. **Se um dia aparecer aqui um `await` ou um
 * `cookies()`, a ficha deixa de ser revisível e volta-se ao ponto de partida.**
 *
 * Os dados estruturados (`RealEstateListing`) ficam na página e não aqui: são
 * metadados da rota, não parte do desenho, e numa storyboard não têm sentido.
 */
export type ListingDetailProps = {
  listing: PublicListingDetail;
  locale: string;
  launchMode: "pre" | "post";
  /** Server Action na app; no canvas, um no-op. */
  onLocaleChange: (locale: string) => void | Promise<void>;
};

function money(cents: number | null): string {
  if (cents === null) return "Sob consulta";
  return new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(cents / 100);
}

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: "2px" }}>
      <span
        style={{
          fontSize: "var(--fs-label)",
          fontWeight: 800,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "var(--muted)",
        }}
      >
        {label}
      </span>
      <strong style={{ fontSize: "var(--fs-body)", color: "var(--text)" }}>{value}</strong>
    </div>
  );
}

export function ListingDetail({ listing, locale, launchMode, onLocaleChange }: ListingDetailProps) {
  const price = listing.deal === "rent" ? listing.rentCents : listing.priceCents;
  const location = [listing.parish, listing.city, listing.district].filter(Boolean).join(", ");

  return (
    <>
      <PublicHeader locale={locale} onLocaleChange={onLocaleChange} launchMode={launchMode} />

      <main>
        <SiteSection>
          <div style={{ display: "grid", gap: "var(--sp-7)" }}>
            <nav aria-label="Caminho" style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>
              <Link href="/imoveis">Imóveis</Link> · {listing.title}
            </nav>

            {/*
              Flex com `wrap` e não `grid` com `auto-fit`: o truque do
              `repeat(auto-fit, minmax(…, 1fr))` colapsa sozinho em ecrã
              estreito — que é o que se quer — mas dá **colunas iguais**, e aqui
              elas não devem ser iguais: o conteúdo é a galeria e os factos, e a
              coluna de ação é um cartão de preço. A 1440 px ficavam 50/50 e a
              galeria saía estreita de mais (visto na captura da storyboard).

              Com `flex`, `flex-grow` reparte o espaço a favor do conteúdo e o
              `flex-basis` decide quando quebra: quando 30rem + 20rem já não
              cabem, a coluna de ação passa para baixo. Continua sem uma única
              media query, como a regra do projeto exige.
            */}
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "clamp(1.5rem, 4vw, 3rem)",
                alignItems: "start",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gap: "var(--sp-6)",
                  minWidth: 0,
                  flex: "1 1 30rem",
                }}
              >
                <ListingGallery photos={listing.photoUrls} title={listing.title} />

                <header style={{ display: "grid", gap: "var(--sp-3)" }}>
                  <h1
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-display)",
                      fontSize: "clamp(1.4rem, 3.4vw, 2.25rem)",
                      lineHeight: 1.15,
                      color: "var(--text)",
                    }}
                  >
                    {listing.title}
                  </h1>
                  {location ? (
                    <span style={{ fontSize: "var(--fs-subtitle)", color: "var(--muted)" }}>
                      {location}
                    </span>
                  ) : null}
                </header>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(9rem, 45%), 1fr))",
                    gap: "var(--sp-5)",
                    padding: "var(--sp-5)",
                    borderRadius: "var(--r-lg)",
                    border: "1px solid var(--border)",
                    background: "var(--surface)",
                  }}
                >
                  {listing.typology ? <Fact label="Tipologia" value={listing.typology} /> : null}
                  {listing.propertyType ? <Fact label="Tipo" value={listing.propertyType} /> : null}
                  {listing.grossArea ? (
                    <Fact label="Área bruta" value={`${listing.grossArea} m²`} />
                  ) : null}
                  {listing.netArea ? (
                    <Fact label="Área útil" value={`${listing.netArea} m²`} />
                  ) : null}
                  {listing.bathrooms ? <Fact label="WC" value={listing.bathrooms} /> : null}
                  {listing.floor ? <Fact label="Piso" value={listing.floor} /> : null}
                  {listing.yearBuilt ? <Fact label="Ano" value={listing.yearBuilt} /> : null}
                  {listing.condition ? <Fact label="Estado" value={listing.condition} /> : null}
                  {listing.energyCert ? (
                    <Fact label="Certificado" value={listing.energyCert} />
                  ) : null}
                  {listing.condoFeeCents !== null ? (
                    <Fact label="Condomínio" value={money(listing.condoFeeCents)} />
                  ) : null}
                </div>

                {listing.description ? (
                  <section style={{ display: "grid", gap: "var(--sp-3)" }}>
                    <h2
                      style={{
                        margin: 0,
                        fontFamily: "var(--font-display)",
                        fontSize: "var(--fs-subtitle-lg)",
                        color: "var(--text)",
                      }}
                    >
                      Descrição do proprietário
                    </h2>
                    <p
                      style={{
                        margin: 0,
                        fontSize: "var(--fs-body)",
                        lineHeight: 1.7,
                        color: "var(--muted)",
                        whiteSpace: "pre-line",
                      }}
                    >
                      {listing.description}
                    </p>
                  </section>
                ) : null}

                {listing.amenities.length > 0 ? (
                  <section style={{ display: "grid", gap: "var(--sp-3)" }}>
                    <h2
                      style={{
                        margin: 0,
                        fontFamily: "var(--font-display)",
                        fontSize: "var(--fs-subtitle-lg)",
                        color: "var(--text)",
                      }}
                    >
                      Comodidades
                    </h2>
                    <ul
                      style={{
                        listStyle: "none",
                        margin: 0,
                        padding: 0,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "var(--sp-3)",
                      }}
                    >
                      {listing.amenities.map((amenity) => (
                        <li
                          key={amenity}
                          style={{
                            fontSize: "var(--fs-body)",
                            color: "var(--text)",
                            padding: "var(--sp-2) var(--sp-4)",
                            borderRadius: "var(--r-pill)",
                            background: "var(--surface2)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          {amenity}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}

                <section style={{ display: "grid", gap: "var(--sp-3)" }}>
                  <h2
                    style={{
                      margin: 0,
                      fontFamily: "var(--font-display)",
                      fontSize: "var(--fs-subtitle-lg)",
                      color: "var(--text)",
                    }}
                  >
                    Localização
                  </h2>
                  {listing.approx ? (
                    <ListingMap
                      lon={listing.approx.lon}
                      lat={listing.approx.lat}
                      radiusM={listing.approx.radiusM}
                    />
                  ) : (
                    <p style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--muted)" }}>
                      {location
                        ? `${location}. O proprietário ainda não marcou a zona no mapa.`
                        : "O proprietário ainda não indicou a localização."}
                    </p>
                  )}
                </section>
              </div>

              {/* Coluna de ação, sticky como no detalhe da app (04 §2.4).
                  `flex: 0 1 20rem` — não cresce, para o espaço que sobra ir
                  todo para a galeria; encolhe até caber e depois quebra. */}
              <aside
                style={{
                  flex: "0 1 20rem",
                  position: "sticky",
                  top: "96px",
                  display: "grid",
                  gap: "var(--sp-5)",
                  padding: "var(--sp-6)",
                  borderRadius: "var(--r-lg)",
                  border: "1px solid var(--border)",
                  background: "var(--surface)",
                }}
              >
                <div style={{ display: "grid", gap: "var(--sp-2)" }}>
                  <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)" }}>
                    {listing.deal === "rent" ? "Arrendamento" : "Venda"}
                  </span>
                  <strong
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "clamp(1.5rem, 3vw, 2rem)",
                      color: "var(--text)",
                      lineHeight: 1.1,
                    }}
                  >
                    {money(price)}
                    {listing.deal === "rent" ? (
                      <span
                        style={{
                          fontSize: "var(--fs-body)",
                          color: "var(--muted)",
                          fontWeight: 400,
                        }}
                      >
                        {" "}
                        / mês
                      </span>
                    ) : null}
                  </strong>
                </div>

                <p style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--muted)" }}>
                  O contacto é feito dentro da plataforma, para o proprietário não receber chamadas
                  nem mensagens de quem não quer.
                </p>

                <Link href="/entrar" className="upm-btn upm-btn--primary upm-btn--md">
                  Entrar para falar
                </Link>
                <Link href="/criar-conta" className="upm-btn upm-btn--secondary upm-btn--md">
                  Criar conta
                </Link>

                <span style={{ fontSize: "var(--fs-label)", color: "var(--muted)" }}>
                  Referência {listing.ref}
                </span>
              </aside>
            </div>
          </div>
        </SiteSection>
      </main>

      <SiteFooter />
    </>
  );
}
