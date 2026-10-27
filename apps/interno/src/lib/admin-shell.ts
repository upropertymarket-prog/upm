import type { SupabaseClient } from "@supabase/supabase-js";
import { getTranslations } from "next-intl/server";
import type { Database, Json } from "@upm/db";
import { mailUnreadCount } from "@upm/db/mail";

export type AdminDashboardPayload = {
  summary: {
    users_total: number;
    users_new_30d: number;
    buyers: number;
    owners: number;
    active_properties: number;
    featured_properties: number;
    pending_moderation: number;
    new_leads: number;
    /** Tickets por fechar. Entrou com P10-02 e fecha D48 — até existir
     *  `tickets`, 07 §21.2 mandou omitir o KPI, porque um zero seria
     *  indistinguível de "nenhum bug aberto". */
    open_bugs: number;
  };
  daily: Array<{ date: string; registrations: number; properties_submitted: number }>;
  activity: Array<{ action: string; entity: string; created_at: string }>;
};

export type AdminShellData = {
  userName: string;
  userMeta: string;
  locale: string;
  counters: Record<string, number>;
  dashboard: AdminDashboardPayload | null;
};

function isRecord(value: Json | undefined): value is { [key: string]: Json | undefined } {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function parseDashboard(value: Json | null | undefined): AdminDashboardPayload | null {
  if (!value || !isRecord(value) || !isRecord(value.summary)) return null;
  const summary = value.summary;
  const numberValue = (key: string) => Number(summary[key] ?? 0);
  const daily = Array.isArray(value.daily)
    ? value.daily.filter(isRecord).map((item) => ({
        date: String(item.date ?? ""),
        registrations: Number(item.registrations ?? 0),
        properties_submitted: Number(item.properties_submitted ?? 0),
      }))
    : [];
  const activity = Array.isArray(value.activity)
    ? value.activity.filter(isRecord).map((item) => ({
        action: String(item.action ?? ""),
        entity: String(item.entity ?? ""),
        created_at: String(item.created_at ?? ""),
      }))
    : [];
  return {
    summary: {
      users_total: numberValue("users_total"),
      users_new_30d: numberValue("users_new_30d"),
      buyers: numberValue("buyers"),
      owners: numberValue("owners"),
      active_properties: numberValue("active_properties"),
      featured_properties: numberValue("featured_properties"),
      pending_moderation: numberValue("pending_moderation"),
      new_leads: numberValue("new_leads"),
      open_bugs: numberValue("open_bugs"),
    },
    daily,
    activity,
  };
}

export async function getAdminShellData(
  supabase: SupabaseClient<Database>,
): Promise<AdminShellData> {
  const [auth, metrics, unread] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("admin_dashboard_metrics"),
    // O badge da Caixa de e-mail do Admin (26 out 2026). Fica fora de
    // `admin_dashboard_metrics` porque não é uma métrica do negócio: é trabalho
    // à espera de quem está a olhar, e a função do painel é partilhada com o
    // próprio painel, que não tem nada que mostrar e-mails por ler.
    mailUnreadCount(supabase),
  ]);
  const profileId = auth.data.user?.id ?? null;
  const [{ data: profile }, { data: staff }] = await Promise.all([
    profileId
      ? supabase.from("profiles").select("full_name,locale").eq("id", profileId).maybeSingle()
      : Promise.resolve({ data: null }),
    profileId
      ? supabase
          .from("staff_members")
          .select("department")
          .eq("profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const translations = await getTranslations();
  const locale = profile?.locale ?? "pt";
  const userName = profile?.full_name?.trim() || auth.data.user?.email || "—";
  const group = translations("sidebar.groups.admin");
  const userMeta = staff?.department ? `${group} · ${staff.department}` : group;
  const dashboard = metrics.error ? null : parseDashboard(metrics.data ?? null);
  return {
    userName,
    userMeta,
    locale,
    dashboard,
    counters: {
      ...(dashboard
        ? {
            propertyModeration: dashboard.summary.pending_moderation,
            siteLeads: dashboard.summary.new_leads,
          }
        : {}),
      mailbox: unread,
    },
  };
}

export async function getAdminSidebarCounters(
  supabase: SupabaseClient<Database>,
): Promise<Record<string, number>> {
  // As duas leituras são independentes: um erro nas métricas do painel não pode
  // apagar o badge do correio, que vem de outra função e continua a saber
  // responder. Era o que acontecia com o `return {}` à cabeça.
  const [{ data, error }, unread] = await Promise.all([
    supabase.rpc("admin_dashboard_metrics"),
    mailUnreadCount(supabase),
  ]);
  const dashboard = error ? null : parseDashboard(data);
  return {
    ...(dashboard
      ? {
          propertyModeration: dashboard.summary.pending_moderation,
          siteLeads: dashboard.summary.new_leads,
        }
      : {}),
    mailbox: unread,
  };
}
