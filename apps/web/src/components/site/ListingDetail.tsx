import Link from "next/link";
import {
  Bath,
  BedDouble,
  CalendarDays,
  Building2,
  Layers,
  Ruler,
  Wallet,
  Zap,
} from "lucide-react";
import { Card, CardBody, StatusTag } from "@upm/ui";

import { PublicHeader } from "../PublicHeader";
import { LISTING_MEDIA_HEIGHT, ListingGallery } from "./ListingGallery";
import { ListingMap } from "./ListingMap";
import { SiteSection } from "./SiteSection";
import { SiteFooter } from "./SiteFooter";
import type { PublicListingDetail } from "../../lib/public-listings";

/**
 * O detalhe de uma propriedade, sem ir buscar nada (P2-05)
 * =========================================================================
 * Separado da `page.tsx` pela mesma razão que o `HomeSections`: a página é um
 * Server Component assíncrono que resolve o slug, lê `properties_public` e
 * redireciona — e nada disso corre dentro de uma storyboard. Com o corte, o que
 * desenha recebe a propriedade por prop e pode ser **visto no canvas**, nos
 * dois temas, sem tocar na base de dados.
 *
 * O corte é certo por si só, canvas à parte: a página passa a ter uma camada
 * que busca e outra que desenha. **Se um dia aparecer aqui um `await` ou um
 * `cookies()`, o detalhe deixa de ser revisível e volta-se ao ponto de
 * partida.**
 *
 * Os dados estruturados (`RealEstateListing`) ficam na página e não aqui: são
 * metadados da rota, não parte do desenho, e numa storyboard não têm sentido.
 *
 * ## O mesmo ecrã que `/market/[id]`, de propósito (13 out 2026)
 *
 * Este detalhe e o `PropertyDetail` da app mostram **a mesma propriedade a
 * pessoas em momentos diferentes**: aqui sem sessão, lá depois de entrar. Quem
 * está a ver um anúncio e cria conta volta a cair na mesma propriedade — e até
 * aqui caía num ecrã com outra galeria, outros cartões de factos, outra coluna
 * de preço. Lia-se como dois produtos.
 *
 * Por isso a estrutura passou a ser **a mesma, e não parecida**:
 *
 *  - `.upm-split` com `--split-cols: minmax(0,1fr) minmax(280px,360px)` e
 *    `--split-gap: 28px`, a classe partilhada de `@upm/ui` — não um
 *    `flex-wrap` com medidas próprias, que foi o que divergiu;
 *  - galeria 3fr/1fr com a altura do `PropertyDetail` (ver `ListingGallery`);
 *  - factos em `<dl>` de cartões com ícone, `minmax(min(100%, 220px), 1fr)`;
 *  - mapa dentro de um `Card`, com "Localização aproximada" e o aviso da
 *    morada exata à direita;
 *  - coluna de ação num `Card`: `StatusTag` do negócio, preço a 30 px, divisor
 *    e por baixo o bloco de quem responde.
 *
 * **O que diverge, diverge por regra do produto e não por desenho.** O
 * `PropertyDetail` mostra o nome do proprietário e "Responde em ~2 h"; aqui
 * não há nome nenhum antes de entrar — é a promessa dos "100 % contactos
 * privados" (04 §2.1). O bloco fica no mesmo sítio, com o mesmo peso, a
 * explicar porquê; é o lugar onde a app mostra o dono e o site mostra a razão
 * de não o mostrar. Pela mesma ordem de ideias não há "Anúncios semelhantes"
 * nem "Mais anúncios de X": ambos exigem saber quem é o dono ou consultar o
 * catálogo autenticado.
 *
 * Em sentido contrário, "Comodidades" existe aqui e não lá — a view pública
 * expõe-nas e são do que mais pesa na decisão de quem está a comparar. Segue o
 * `h2` de 17 px das outras secções, para não se ler como uma peça estranha.
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

/** Os ícones dos factos, como no `PropertyDetail`: neutros e do tamanho do rótulo. */
const FACT_ICON = { size: 15, "aria-hidden": true, style: { flexShrink: 0 } } as const;

/**
 * Um facto, no cartão do `PropertyDetail` — borda, raio 12, 14 px de enchimento.
 * Sem valor não se desenha: um "Piso —" ocupa uma célula para não dizer nada.
 */
function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  if (value === null || value === undefined || value === "") return null;
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

/** O `h2` das secções da ficha: 17 px, igual ao do `PropertyDetail`. */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: 0, fontSize: 17 }}>{children}</h2>;
}

export function ListingDetail({ listing, locale, launchMode, onLocaleChange }: ListingDetailProps) {
  const price = listing.deal === "rent" ? listing.rentCents : listing.priceCents;
  // " · " e não ", ": é o separador do `PropertyDetail`, na mesma linha ⌖.
  const location = [listing.parish, listing.city, listing.district].filter(Boolean).join(" · ");

  return (
    <>
      <PublicHeader locale={locale} onLocaleChange={onLocaleChange} launchMode={launchMode} />

      <main>
        <SiteSection>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            {/* A mesma saída do `PropertyDetail` ("← Voltar ao Market"), para o
                mesmo sítio desta banda: o catálogo público. */}
            <Link
              href="/imoveis"
              className="upm-btn upm-btn--secondary upm-btn--sm"
              style={{ alignSelf: "flex-start", textDecoration: "none" }}
            >
              ← Voltar às propriedades
            </Link>

            {/* `.upm-split` de `@upm/ui`, com as medidas do `PropertyDetail`.
                `--split-aside-top` é o que muda: lá a conta é com a topbar da
                app, aqui com a navbar do site, que tem 84 px. */}
            <div
              className="upm-split"
              style={
                {
                  "--split-cols": "minmax(0, 1fr) minmax(280px, 360px)",
                  "--split-gap": "28px",
                  "--split-aside-top": "96px",
                } as React.CSSProperties
              }
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 24,
                  minWidth: 0,
                }}
              >
                <ListingGallery photos={listing.photoUrls} title={listing.title} />

                <header style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <span style={{ color: "var(--muted)", fontSize: 12 }}>Ref. {listing.ref}</span>
                  <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.15 }}>{listing.title}</h1>
                  {location ? (
                    <p style={{ margin: 0, color: "var(--muted)" }}>⌖ {location}</p>
                  ) : null}
                </header>

                {/* Cartões de facto, não uma caixa só: é a grelha do
                    `PropertyDetail`, e os 220 px é que lhe dão três colunas em
                    ecrã largo e duas, depois uma, sem media query. */}
                <dl
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
                    gap: 12,
                    margin: 0,
                  }}
                >
                  <Fact
                    icon={<BedDouble {...FACT_ICON} />}
                    label="Tipologia"
                    value={listing.typology}
                  />
                  <Fact
                    icon={<Building2 {...FACT_ICON} />}
                    label="Tipo"
                    value={listing.propertyType}
                  />
                  <Fact
                    icon={<Ruler {...FACT_ICON} />}
                    label="Área bruta"
                    value={listing.grossArea ? `${listing.grossArea} m²` : null}
                  />
                  <Fact
                    icon={<Ruler {...FACT_ICON} />}
                    label="Área útil"
                    value={listing.netArea ? `${listing.netArea} m²` : null}
                  />
                  <Fact
                    icon={<Bath {...FACT_ICON} />}
                    label="Casas de banho"
                    value={listing.bathrooms?.toString() ?? null}
                  />
                  <Fact icon={<Layers {...FACT_ICON} />} label="Piso" value={listing.floor} />
                  <Fact
                    icon={<CalendarDays {...FACT_ICON} />}
                    label="Ano de construção"
                    value={listing.yearBuilt?.toString() ?? null}
                  />
                  <Fact
                    icon={<Building2 {...FACT_ICON} />}
                    label="Estado"
                    value={listing.condition}
                  />
                  <Fact
                    icon={<Zap {...FACT_ICON} />}
                    label="Certificado energético"
                    value={listing.energyCert}
                  />
                  <Fact
                    icon={<Wallet {...FACT_ICON} />}
                    label="Condomínio"
                    value={listing.condoFeeCents !== null ? money(listing.condoFeeCents) : null}
                  />
                </dl>

                {listing.description ? (
                  <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <SectionTitle>Descrição do proprietário</SectionTitle>
                    <p
                      style={{
                        margin: 0,
                        lineHeight: 1.75,
                        color: "var(--muted)",
                        whiteSpace: "pre-line",
                      }}
                    >
                      {listing.description}
                    </p>
                  </section>
                ) : null}

                {listing.amenities.length > 0 ? (
                  <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <SectionTitle>Comodidades</SectionTitle>
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

                {/* O mapa dentro de um `Card`, com o cabeçalho do
                    `PropertyDetail`: o título à esquerda e o aviso da morada
                    exata encostado à direita. */}
                <Card>
                  <CardBody style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <strong>Localização aproximada</strong>
                      <span style={{ marginLeft: "auto", color: "var(--muted)", fontSize: 12 }}>
                        morada exata após contacto
                      </span>
                    </div>
                    {listing.approx ? (
                      <ListingMap
                        lon={listing.approx.lon}
                        lat={listing.approx.lat}
                        radiusM={listing.approx.radiusM}
                      />
                    ) : (
                      <p style={{ margin: 0, color: "var(--muted)" }}>
                        {location
                          ? `${location}. O proprietário ainda não marcou a zona no mapa.`
                          : "O proprietário ainda não indicou a localização."}
                      </p>
                    )}
                  </CardBody>
                </Card>
              </div>

              {/* A coluna de ação do `PropertyDetail`, peça a peça: `StatusTag`
                  do negócio, preço a 30 px, divisor, e no lugar onde a app põe
                  o proprietário o site põe a razão de não o pôr. */}
              <aside
                className="upm-split__aside upm-split__aside--sticky"
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {/* A mesma altura da galeria: as duas peças do topo fecham na
                    mesma linha. `minHeight` e não `height` — se o preço ou o
                    texto crescerem, o cartão cresce com eles em vez de cortar. */}
                <Card style={{ minHeight: LISTING_MEDIA_HEIGHT }}>
                  {/* O cartão é mais alto do que o seu conteúdo — acompanha a
                      galeria —, por isso há folga a repartir, e ela reparte-se
                      pelas duas pontas: `center`, não as ações encostadas à
                      base (punha tudo num buraco entre o texto e os botões).

                      **`flex: 1` e não `height: 100%`.** `.upm-card` é um flex
                      column com `min-height`; uma percentagem de altura resolve
                      contra a altura do pai, que aqui é `auto`, logo o corpo
                      não esticava — ficava à altura do conteúdo e a folga caía
                      **por baixo dele**, fora da caixa que o `justifyContent`
                      governa. No eixo principal de um flex quem estica é
                      `flex`, e é essa a correção. */}
                  <CardBody
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "center",
                      gap: 18,
                      flex: 1,
                    }}
                  >
                    {listing.deal ? (
                      <StatusTag tone={listing.deal === "sale" ? "dealSale" : "dealRent"}>
                        {listing.deal === "sale" ? "Venda" : "Arrendamento"}
                      </StatusTag>
                    ) : null}

                    <strong style={{ fontSize: 30 }}>
                      {money(price)}
                      {listing.deal === "rent" ? (
                        <span style={{ fontSize: 15, color: "var(--muted)", fontWeight: 400 }}>
                          {" "}
                          / mês
                        </span>
                      ) : null}
                    </strong>

                    {/* Onde a app mostra o nome do dono e "Responde em ~2 h".
                        Sem sessão não há nome: é a promessa de 04 §2.1, e o
                        lugar serve para a explicar em vez de ficar vazio. */}
                    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                      <strong>Fala diretamente com o proprietário</strong>
                      <div style={{ color: "var(--muted)", fontSize: 12 }}>
                        O contacto é feito dentro da plataforma — sem chamadas nem partilha de
                        número.
                      </div>
                    </div>

                    <div style={{ display: "grid", gap: 16 }}>
                      <Link href="/entrar" className="upm-btn upm-btn--primary upm-btn--md">
                        Entrar para falar
                      </Link>
                      <Link
                        href="/criar-conta"
                        className="upm-btn upm-btn--secondary upm-btn--md"
                      >
                        Criar conta
                      </Link>
                    </div>
                  </CardBody>
                </Card>
              </aside>
            </div>
          </div>
        </SiteSection>
      </main>

      <SiteFooter />
    </>
  );
}
