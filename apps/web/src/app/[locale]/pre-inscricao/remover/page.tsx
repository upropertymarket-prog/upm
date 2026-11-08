import { getLocale } from "next-intl/server";

import { pageMetadata } from "@/lib/seo-overrides";
import { seo } from "./seo";

import { PublicHeader } from "@/components/PublicHeader";
import { SiteSection } from "@/components/site/SiteSection";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getLaunchMode } from "@/lib/launch-mode";
import { removePreRegistration } from "./actions";
import { RemovePanel } from "./RemovePanel";

/** `seo.ts` desta rota, com a sobreposição de `seo_pages` por cima (P2-06). */
export function generateMetadata() {
  return pageMetadata(seo, { pathname: "/pre-inscricao/remover" });
}

/**
 * `/pre-inscricao/remover` — o link "remover a minha pré-inscrição" (8 nov 2026)
 * =========================================================================
 * Vem no e-mail de confirmação. Abre uma página com um botão, e é o botão que
 * apaga (`actions.ts`). A moldura é a do site, como a da confirmação: quem
 * chega aqui é um visitante sem conta.
 */
export default async function RemovePreRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const [locale, launchMode, params] = await Promise.all([
    getLocale(),
    getLaunchMode(),
    searchParams,
  ]);
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <>
      <PublicHeader locale={locale} launchMode={launchMode} />

      <main>
        <SiteSection>
          <RemovePanel token={token} onRemove={removePreRegistration} />
        </SiteSection>
      </main>

      <SiteFooter />
    </>
  );
}
