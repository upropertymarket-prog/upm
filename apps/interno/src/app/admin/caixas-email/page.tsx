import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";

import { InternalChrome } from "../../../components/InternalChrome";
import { getAdminSidebarCounters } from "../../../lib/admin-shell";
import { setLocalePreference } from "../../actions/preferences";
import { saveMailbox, saveMailboxSecret, testMailboxConnection } from "./actions";
import { MailboxManager, type MailboxRow, type StaffOption } from "./MailboxManager";

/**
 * `/admin/caixas-email` — as caixas do Suporte (P10-03 · 04 §2.5)
 * =========================================================================
 * **A entrada do menu já existia e não levava a lado nenhum.** `navigation.ts`
 * tem `{ id: "mailboxes", href: "/admin/caixas-email" }` desde a Fase 1, e a
 * rota nunca foi criada — um item de sidebar a dar 404 em todas as sessões de
 * admin. Esta página fecha isso.
 *
 * `select` explícito e **sem `secret_id`**: o ecrã só precisa de saber se a
 * credencial está definida, não qual é o ponteiro para o Vault. O que vai para
 * o cliente é um booleano derivado no servidor (08 §6.3 — nada de sensível no
 * cliente).
 *
 * A lista de responsáveis sai de `staff_members`, que é a tabela que 05 §6.1
 * define como fonte das variáveis de assinatura — a mesma de onde P10-06 as
 * vai resolver.
 *
 * `force-dynamic` pela mesma razão do `/admin/seo`: a lista muda a cada
 * gravação e é um ecrã de administração.
 */
export const dynamic = "force-dynamic";

export default async function MailboxesPage() {
  const supabase = createClient(await cookies());

  const [auth, mailboxesResult, staffResult, sidebarCounters] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from("mailboxes")
      .select(
        "id, address, display_name, protocol, in_host, in_port, in_security, smtp_host, smtp_port, smtp_security, username, department, owner_profile_id, status, secret_id, last_sync_at, last_error",
      )
      .order("address"),
    supabase.from("staff_members").select("profile_id, profiles(full_name)"),
    getAdminSidebarCounters(supabase),
  ]);

  const rows: MailboxRow[] = (mailboxesResult.data ?? []).map((row) => ({
    id: row.id,
    address: row.address,
    displayName: row.display_name ?? "",
    protocol: row.protocol,
    inHost: row.in_host,
    inPort: row.in_port,
    inSecurity: row.in_security,
    smtpHost: row.smtp_host,
    smtpPort: row.smtp_port,
    smtpSecurity: row.smtp_security,
    username: row.username,
    department: row.department,
    ownerProfileId: row.owner_profile_id,
    status: row.status,
    // Só o facto, nunca o ponteiro — ver a nota de topo.
    hasSecret: row.secret_id !== null,
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
  }));

  const staff: StaffOption[] = (staffResult.data ?? []).map((member) => {
    const profile = member.profiles as { full_name: string | null } | null;
    return { id: member.profile_id, name: profile?.full_name?.trim() || "(sem nome)" };
  });

  const userId = auth.data.user?.id ?? null;
  const [{ data: profile }, { data: me }] = await Promise.all([
    userId
      ? supabase.from("profiles").select("full_name,locale").eq("id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
    userId
      ? supabase.from("staff_members").select("department").eq("profile_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const t = await getTranslations();
  const locale = profile?.locale ?? "pt";
  const userName = profile?.full_name?.trim() || auth.data.user?.email || "—";
  const userMeta = me?.department
    ? `${t("sidebar.groups.admin")} · ${me.department}`
    : t("sidebar.groups.admin");

  return (
    <InternalChrome
      role="admin"
      userName={userName}
      userMeta={userMeta}
      activeId="mailboxes"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={sidebarCounters}
    >
      <MailboxManager
        rows={rows}
        staff={staff}
        loadError={Boolean(mailboxesResult.error)}
        onSave={saveMailbox}
        onSaveSecret={saveMailboxSecret}
        onTest={testMailboxConnection}
      />
    </InternalChrome>
  );
}
