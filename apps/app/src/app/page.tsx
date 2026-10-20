import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getLocale } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { Button, PageHeader, greetingKey } from "@upm/ui";

import { AppChrome } from "../components/AppChrome";
import { ComponentsPreview } from "../components/ComponentsPreview";
import {
  DEMO_OWNER_COUNTERS,
  DEMO_OWNER_FULL_NAME,
  DEMO_OWNER_META,
  DEMO_OWNER_NAME,
  DEMO_OWNER_NOTIFICATIONS,
} from "../lib/demo-data/ownerShell";
import { setLocalePreference } from "./actions/preferences";

/**
 * Ecrã de verificação da Fase 1 (P1-04 · P1-05)
 * =========================================================================
 * Monta o shell real com a navegação do proprietário e os 14 componentes base,
 * para se poder ver hover, foco, desativado e modo escuro num ecrã verdadeiro —
 * e para a Route Storyboard do canvas do design system ter onde apontar, agora
 * que o Storybook saiu (07 §4.5).
 *
 * **Meio caminho.** O `/painel` do proprietário já existe (P4-06) e o dono é
 * redirecionado para lá, como 03 §1.2 pede. O comprador fica neste ecrã até o
 * Painel de 04 §8.2 nascer — e então esta rota passa a redirecionar sempre e
 * o `ComponentsPreview` desaparece com ela. Os dados aqui são fixos.
 */
export default async function Page() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role === "owner") redirect("/painel");
  }

  const [t, locale] = await Promise.all([getTranslations(), getLocale()]);
  const greeting = t(`greeting.${greetingKey()}`, { name: DEMO_OWNER_NAME });

  return (
    <AppChrome
      role="owner"
      userName={DEMO_OWNER_FULL_NAME}
      userMeta={DEMO_OWNER_META}
      activeId="dashboard"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={DEMO_OWNER_COUNTERS}
      notifications={DEMO_OWNER_NOTIFICATIONS}
    >
      <PageHeader
        title={greeting}
        subtitle={t("dashboard.ownerSubtitle")}
        actions={
          <>
            <Button variant="secondary">{t("common.export")}</Button>
            <Button>{t("nav.newProperty")}</Button>
          </>
        }
      />
      <ComponentsPreview />
    </AppChrome>
  );
}
