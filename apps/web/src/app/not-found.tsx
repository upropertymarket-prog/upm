import Link from "next/link";
import { getLocale } from "next-intl/server";

import { PublicHeader } from "../components/PublicHeader";
import { SectionHeading, SiteSection } from "../components/site/SiteSection";
import { SiteFooter } from "../components/site/SiteFooter";
import { getLaunchMode } from "../lib/launch-mode";
import { setLocalePreference } from "./actions/preferences";

/**
 * 404 do site público — qualquer rota que não exista (P2-05)
 * =========================================================================
 * Até 13 out 2026 não havia ficheiro nenhum, e o Next servia o seu ecrã por
 * omissão: fundo branco, "404 | This page could not be found", em inglês, sem
 * navbar e sem rodapé. Não é um caso de laboratório — a `/imoveis/[slug]`
 * chama `notFound()` em dois caminhos reais (slug sem uuid e propriedade que
 * saiu de `active`), por isso é o que vê quem abre um link partilhado de um
 * anúncio entretanto removido. Essa pessoa veio de uma partilha, não sabe o
 * que correu mal, e o ecrã do Next não lhe dá saída nenhuma.
 *
 * O caminho continua a ser `/imoveis` enquanto a rota não for renomeada — o
 * texto já diz "propriedades", o URL ainda não.
 *
 * Daí este ser uma página do site e não um aviso: tem a navbar, tem o rodapé e
 * tem dois caminhos para a frente — o catálogo e a home. O catálogo primeiro,
 * porque quem cai aqui estava quase sempre a ver uma propriedade.
 *
 * **`robots: noindex`** e nada de `generateMetadata` com `pageMetadata`: um 404
 * não leva sobreposição de `seo_pages` nem entra no índice. O Next serve-a com
 * o estado 404 correto por ser `not-found.tsx` — não é preciso forçar nada.
 */
export const metadata = {
  title: "Página não encontrada · UProperty Market",
  robots: { index: false, follow: true },
};

export default async function NotFound() {
  const [locale, launchMode] = await Promise.all([getLocale(), getLaunchMode()]);

  return (
    <>
      <PublicHeader locale={locale} onLocaleChange={setLocalePreference} launchMode={launchMode} />

      <main>
        <SiteSection>
          <div style={{ display: "grid", gap: "var(--sp-6)", justifyItems: "center" }}>
            <SectionHeading
              eyebrow="Erro 404"
              title="Esta página não existe."
              body="O link pode estar errado, ou a propriedade que procura já não está publicada. Quem a anunciou pode tê-la vendido, arrendado ou retirado."
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
              <Link href="/" className="upm-btn upm-btn--secondary upm-btn--md">
                Voltar à página inicial
              </Link>
            </div>
          </div>
        </SiteSection>
      </main>

      <SiteFooter />
    </>
  );
}
