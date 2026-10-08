import { getLocale } from "next-intl/server";

import { pageMetadata } from "@/lib/seo-overrides";
import { seo } from "./seo";

import { PublicHeader } from "../../components/PublicHeader";
import { SectionHeading, SiteSection } from "../../components/site/SiteSection";
import { SiteFooter } from "../../components/site/SiteFooter";
import { getLaunchMode } from "../../lib/launch-mode";
import { COMING_SOON } from "../../lib/site-content";
import { FeatureGrid } from "../../components/site/FeatureGrid";
import { setLocalePreference } from "../actions/preferences";
import { submitPreRegistration } from "./actions";
import { PreRegistrationForm } from "./PreRegistrationForm";

/** `seo.ts` desta rota, com a sobreposição de `seo_pages` por cima (P2-06). */
export function generateMetadata() {
  return pageMetadata(seo, "/pre-inscricao");
}

/**
 * `/pre-inscricao` — a página de conversão do pré-lançamento (P2-02)
 * =========================================================================
 * Página própria e não um modal na home: é o destino de todos os CTA do site
 * em modo `pre`, tem de ser partilhável por link e tem de poder ser indexada.
 *
 * Os quatro cartões de "Em breve" repetem-se aqui de propósito. Quem chega
 * por um link direto — de um anúncio, de uma partilha — não passou pela home
 * e não viu nenhuma razão para se inscrever; o formulário sozinho pede sem
 * dar nada em troca.
 */
export default async function PreRegistrationPage() {
  const [locale, launchMode] = await Promise.all([getLocale(), getLaunchMode()]);

  return (
    <>
      <PublicHeader locale={locale} onLocaleChange={setLocalePreference} launchMode={launchMode} />

      <main>
        <SiteSection>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(20rem, 100%), 1fr))",
              gap: "clamp(1.5rem, 4vw, 3rem)",
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: "var(--sp-6)" }}>
              <SectionHeading
                eyebrow={COMING_SOON.eyebrow}
                title={COMING_SOON.title}
                body={COMING_SOON.body}
              />
              <FeatureGrid cards={COMING_SOON.cards} minColumn="13rem" />
            </div>
            <PreRegistrationForm onSubmit={submitPreRegistration} />
          </div>
        </SiteSection>
      </main>

      <SiteFooter />
    </>
  );
}
