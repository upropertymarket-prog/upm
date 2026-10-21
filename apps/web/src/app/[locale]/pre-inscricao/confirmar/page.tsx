import { getLocale } from "next-intl/server";

import { pageMetadata } from "@/lib/seo-overrides";
import { seo } from "./seo";

import { PublicHeader } from "@/components/PublicHeader";
import { SiteSection } from "@/components/site/SiteSection";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getLaunchMode } from "@/lib/launch-mode";
import { confirmPreRegistration } from "./actions";
import { ConfirmPanel } from "./ConfirmPanel";

/** `seo.ts` desta rota, com a sobreposição de `seo_pages` por cima (P2-06). */
export function generateMetadata() {
  return pageMetadata(seo, { pathname: "/pre-inscricao/confirmar" });
}

/**
 * `/pre-inscricao/confirmar` — o destino do link do e-mail (P2-02)
 * =========================================================================
 * A página fecha o double opt-in que `submit_site_lead` abre. Até existir,
 * `confirm_site_lead` estava no esquema sem ninguém a chamá-lo e nenhuma
 * pré-inscrição contava como lead.
 *
 * Tem a moldura do site — cabeçalho e rodapé — e não a `AuthShell`: quem chega
 * aqui é um visitante sem conta, e o fim natural do caminho é continuar a ver
 * o site, não entrar em nada.
 *
 * `noindex` no `seo.ts`: o URL traz um token.
 */
export default async function ConfirmPreRegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const [locale, launchMode, params] = await Promise.all([
    getLocale(),
    getLaunchMode(),
    searchParams,
  ]);

  // `?token=a&token=b` chega como lista. Nenhum link nosso faz isso, e o que
  // vier daí trata-se como ausência — a action valida a forma de qualquer modo.
  const token = typeof params.token === "string" ? params.token : "";

  return (
    <>
      <PublicHeader locale={locale} launchMode={launchMode} />

      <main>
        <SiteSection>
          <ConfirmPanel token={token} onConfirm={confirmPreRegistration} />
        </SiteSection>
      </main>

      <SiteFooter />
    </>
  );
}
