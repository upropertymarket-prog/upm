import { getLocale } from "next-intl/server";
import { Card, CardBody, CardHeader, CardTitle, PageHeader } from "@upm/ui";

import { PublicHeader } from "../components/PublicHeader";
import { setLocalePreference } from "./actions/preferences";

import { buildMetadata } from "@/lib/seo";
import { seo } from "./seo";

/** Metadados a partir do `seo.ts` desta rota (P2-06). */
export function generateMetadata() {
  return buildMetadata(seo, "/");
}

/**
 * Ecrã de verificação da Fase 1 em `www` (P1-01 · P1-02 · P1-03 · P1-06)
 * =========================================================================
 * Prova que os tokens, as fontes auto-hospedadas, o tema e o i18n funcionam no
 * site público com o mínimo de **14 px** de 07 §3 (`data-app="web"` no layout).
 *
 * **Provisório.** A Fase 5 substitui pela home de 04 §8.1 (hero, A plataforma,
 * Sobre nós, Para empresas, Em breve / Imóveis mais recentes, Preços, Dúvidas,
 * Contactos e rodapé de 5 colunas).
 */
export default async function Page() {
  const locale = await getLocale();

  return (
    <>
      <PublicHeader locale={locale} onLocaleChange={setLocalePreference} />
      <main className="upm-shell__content">
        <PageHeader
          title="UProperty Market"
          subtitle="0 % comissão · 100 % contactos privados · 4 perfis"
        />
        <Card>
          <CardHeader>
            <CardTitle>Fase 1 — fundações visuais</CardTitle>
          </CardHeader>
          <CardBody>
            Tokens claro/escuro, Bricolage Grotesque, Manrope e JetBrains Mono auto-hospedadas,
            alternador de tema sem clarão e PT/EN. O site público de 04 §8.1 entra na Fase 5.
          </CardBody>
        </Card>
      </main>
    </>
  );
}
