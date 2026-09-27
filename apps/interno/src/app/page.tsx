import { getLocale, getTranslations } from "next-intl/server";
import { Button, Card, CardBody, CardHeader, CardTitle, PageHeader } from "@upm/ui";

import { InternalChrome } from "../components/InternalChrome";
import { setLocalePreference } from "./actions/preferences";

/**
 * Ecrã de verificação da Fase 1 em `interno.*` (P1-05)
 * =========================================================================
 * Prova que o shell é o mesmo das outras apps com a navegação de Admin de
 * 07 §4.1 — o critério de "idêntico nos 4 perfis" de 04 §5.5.
 *
 * **Provisório.** A Fase 9 substitui por `/admin/painel` (03 §1.3).
 */
export default async function Page() {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);

  return (
    <InternalChrome
      role="admin"
      userName="Helena Matos"
      userMeta="Administração · IT"
      activeId="dashboard"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={{ propertyModeration: 4, siteLeads: 12 }}
      notifications={[
        { id: "n1", text: "4 imóveis à espera de moderação", when: "há 10 min", read: false },
      ]}
    >
      <PageHeader
        title={t("nav.dashboard")}
        subtitle="Estado da plataforma"
        actions={<Button variant="secondary">{t("common.export")}</Button>}
      />
      <Card>
        <CardHeader>
          <CardTitle>Fase 1 — design system</CardTitle>
        </CardHeader>
        <CardBody>
          Tokens, fontes auto-hospedadas, tema claro/escuro, componentes base e este shell estão em
          `packages/ui`. As páginas de Administração de 04 §8.5 entram na Fase 9.
        </CardBody>
      </Card>
    </InternalChrome>
  );
}
