import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { Card, PageHeader, ThemeToggle } from "@upm/ui";
import { notificationPrefsSchema, type NotificationPrefs } from "@upm/db/interaction";

import { AppChrome } from "../../components/AppChrome";
import { DangerZone } from "../../components/settings/DangerZone";
import { NotificationPrefsForm } from "../../components/settings/NotificationPrefsForm";
import { deleteOwnAccount, exportAccountData } from "../actions/account";
import {
  countersFor,
  loadConversations,
  loadLeads,
  loadNotifications,
  loadVisits,
} from "../../lib/interaction";
import { updateNotificationPrefs } from "../actions/notifications";
import { setLocalePreference } from "../actions/preferences";

export const dynamic = "force-dynamic";

/**
 * Definições — `/definicoes` (P5-04 · 04 §8.3)
 * =========================================================================
 * 04 §8.3 dá a esta página cinco secções, por esta ordem: Perfil, Preferências,
 * Notificações, Aparência e Zona de perigo. Três existem: Notificações (Fase 5),
 * Aparência (Fase 1, `ThemeToggle`) e **Zona de perigo (Fase 9, P9-06)** —
 * exportação e eliminação da conta, que 02 §7.3 exige.
 *
 * As outras duas continuam a não ficar como caixas vazias: Perfil, e
 * Preferências de procura, que dependem de `profiles.preferences`. D25 mantém-se
 * aberta por essas duas.
 */
export default async function SettingsPage() {
  const supabase = createClient(await cookies());
  const [t, locale, { data: authData }] = await Promise.all([
    getTranslations(),
    getLocale(),
    supabase.auth.getUser(),
  ]);

  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name, notification_prefs")
    .eq("id", user.id)
    .single();
  const role = profile?.role === "owner" ? "owner" : "buyer";

  const [conversations, visits, notifications] = await Promise.all([
    loadConversations(supabase),
    loadVisits(supabase),
    loadNotifications(supabase),
  ]);
  const leads = role === "owner" ? await loadLeads(supabase) : [];

  // Um `notification_prefs` corrompido não pode deitar a página abaixo: o que
  // não valida cai para o vazio, que a função `notify()` lê como "tudo ligado".
  const parsed = notificationPrefsSchema.safeParse(profile?.notification_prefs ?? {});
  const prefs: NotificationPrefs = parsed.success ? parsed.data : {};

  return (
    <AppChrome
      role={role}
      userName={profile?.full_name || "Utilizador"}
      userMeta={role === "owner" ? "Proprietário" : "Comprador"}
      activeId="settings"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={countersFor(role, conversations, visits, leads)}
      notifications={notifications}
    >
      <PageHeader title="Definições" subtitle="Conta, perfil e notificações" />

      <div style={{ display: "grid", gap: "var(--sp-8)" }}>
        <NotificationPrefsForm prefs={prefs} onSave={updateNotificationPrefs} />

        <Card padded style={{ display: "grid", gap: "var(--sp-6)" }}>
          <div style={{ display: "grid", gap: "var(--sp-2)" }}>
            <h2 style={{ margin: 0, fontSize: "var(--fs-subtitle-lg)" }}>Aparência</h2>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              A escolha fica guardada nesta conta e segue-a noutros dispositivos.
            </p>
          </div>
          <ThemeToggle
            variant="inline"
            labels={{
              title: t("theme.title"),
              light: t("theme.light"),
              dark: t("theme.dark"),
              system: t("theme.system"),
            }}
          />
        </Card>

        {/*
          Zona de perigo — Fase 9, P9-06. Fecha a metade de D25 que faltava.
          Continuam a faltar as secções Perfil e Preferências de procura, que
          D25 mantém abertas: `profiles.preferences` existe mas o ecrã não.
        */}
        <DangerZone
          onExport={exportAccountData}
          onDelete={deleteOwnAccount}
          afterDeleteUrl={process.env.WEB_URL ?? "http://localhost:4300"}
        />
      </div>
    </AppChrome>
  );
}
