import Link from "next/link";

import { PublicHeader } from "../PublicHeader";
import { ListingCard } from "./ListingCard";
import { SectionHeading, SiteSection } from "./SiteSection";
import { SiteFooter } from "./SiteFooter";
import type { ListingAvailability, PublicListingCard } from "../../lib/public-listings";

/**
 * O anúncio saiu de circulação — `/imoveis/[slug]` (P2-05)
 * =========================================================================
 * Não é um 404 com outra roupa. O 404 responde "esta página não existe", que
 * para quem clicou numa partilha de há duas semanas é **falso**: a página
 * existiu, e essa pessoa talvez a tenha visto. O que ela quer saber é o que
 * aconteceu, e um 404 deixa-a com a sensação de ter feito asneira.
 *
 * É também o visitante mais qualificado que o site recebe — quis aquela
 * tipologia, naquela zona, naquele preço. Daí as alternativas: mesmo negócio e
 * mesma cidade, que é tudo o que se sabe sobre o anúncio que saiu (a
 * `listing_availability` só devolve `deal` e `city`, de propósito).
 *
 * **"Vendida na UProperty Market" é publicidade, não um erro.** É dos poucos
 * sítios do site onde uma ausência prova que a plataforma funciona, e por isso
 * o título diz o desfecho em vez de o esconder atrás de "indisponível".
 *
 * Sem alternativas nenhumas a secção desaparece e ficam os dois botões — uma
 * grelha vazia sob "Outras propriedades" seria pior do que não a ter, a mesma
 * regra do `RecentListings`.
 *
 * ## O estado HTTP, que é o ponto por fechar
 *
 * O correto aqui é **410 Gone**: diz ao Google para retirar o URL do índice
 * bem mais depressa do que um 404, e muito mais do que um 200. O App Router do
 * Next não tem forma suportada de devolver um estado arbitrário a partir de um
 * Server Component — há `notFound()` (404) e nada para 410. Esta página serve
 * portanto **200 com `noindex`**, que atinge o mesmo fim (sai do índice) por um
 * caminho mais lento.
 *
 * O caminho para o 410, quando valer a pena: um `middleware.ts` que intercete
 * `/imoveis/:slug`, pergunte a disponibilidade e responda
 * `new NextResponse(html, { status: 410 })`. Fica por fazer por causa do custo
 * — o middleware corre em todos os pedidos da rota e teria de falar com a base
 * de dados antes de cada um — e porque o ganho só se mede quando houver
 * catálogo a sério e URL indexados. Até lá, `noindex` resolve.
 */

const TITLES: Record<"sold" | "rented" | "withdrawn", string> = {
  sold: "Esta propriedade já foi vendida.",
  rented: "Esta propriedade já foi arrendada.",
  withdrawn: "Esta propriedade já não está disponível.",
};

const BODIES: Record<"sold" | "rented" | "withdrawn", string> = {
  sold: "O negócio fez-se aqui, diretamente entre as duas partes e sem comissões. O anúncio deixou de estar publicado.",
  rented:
    "O negócio fez-se aqui, diretamente entre as duas partes e sem comissões. O anúncio deixou de estar publicado.",
  withdrawn: "O proprietário retirou o anúncio. Pode ter mudado de ideias ou voltar mais tarde.",
};

export type ListingGoneProps = {
  availability: Extract<ListingAvailability, { outcome: "gone" }>;
  /** Mesmo negócio e mesma cidade. Vazio esconde a secção. */
  alternatives: PublicListingCard[];
  locale: string;
  launchMode: "pre" | "post";
  onLocaleChange: (locale: string) => void | Promise<void>;
};

export function ListingGone({
  availability,
  alternatives,
  locale,
  launchMode,
  onLocaleChange,
}: ListingGoneProps) {
  const { reason, city } = availability;

  return (
    <>
      <PublicHeader locale={locale} onLocaleChange={onLocaleChange} launchMode={launchMode} />

      <main>
        <SiteSection>
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <SectionHeading
              eyebrow="Anúncio encerrado"
              title={TITLES[reason]}
              body={BODIES[reason]}
              align="center"
            />

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--sp-4)",
                justifyContent: "center",
              }}
            >
              <Link href="/imoveis" className="upm-btn upm-btn--primary upm-btn--md">
                Ver propriedades
              </Link>
              <Link href="/criar-conta" className="upm-btn upm-btn--secondary upm-btn--md">
                Criar alerta para novas propriedades
              </Link>
            </div>
          </div>
        </SiteSection>

        {alternatives.length > 0 ? (
          <SiteSection tone="alt">
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
              <SectionHeading
                title={city ? `Outras propriedades em ${city}` : "Outras propriedades"}
                body="Do mesmo tipo de negócio, publicadas por proprietários diretos."
              />
              <ul
                style={{
                  listStyle: "none",
                  margin: 0,
                  padding: 0,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(min(18rem, 100%), 1fr))",
                  gap: "var(--sp-5)",
                  alignItems: "stretch",
                }}
              >
                {alternatives.map((listing) => (
                  <li key={listing.id} style={{ display: "grid" }}>
                    <ListingCard listing={listing} />
                  </li>
                ))}
              </ul>
            </div>
          </SiteSection>
        ) : null}
      </main>

      <SiteFooter />
    </>
  );
}
