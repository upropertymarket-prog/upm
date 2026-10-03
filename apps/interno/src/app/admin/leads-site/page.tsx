import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { Database } from "@upm/db";
import { createClient } from "@upm/db/server";
import { InternalChrome } from "../../../components/InternalChrome";
import { setLocalePreference } from "../../actions/preferences";
import { verifyOperationPin } from "../../actions/step-up";
import { addLeadNote, exportLeads, updateLead } from "./actions";
import { LeadsManager } from "./LeadsManager";
import { getAdminSidebarCounters } from "../../../lib/admin-shell";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;
const uuid = z.string().uuid();
const statuses = ["new", "contacted", "qualified", "converted", "discarded"] as const;
const sources = ["pre_launch", "post_launch"] as const;
const forms = ["preinscricao", "contacto", "empresas"] as const;
type LeadRow = Database["public"]["Functions"]["admin_list_site_leads"]["Returns"][number];
type LeadDetail = Database["public"]["Functions"]["admin_site_lead_detail"]["Returns"][number];
type LeadEvent = Database["public"]["Functions"]["admin_site_lead_history"]["Returns"][number];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SiteLeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const statusResult = z.enum(statuses).safeParse(first(params.status) ?? "");
  const sourceResult = z.enum(sources).safeParse(first(params.source) ?? "");
  const formResult = z.enum(forms).safeParse(first(params.form) ?? "");
  const assignedRaw = first(params.assigned_to) ?? "";
  const assigned = uuid.safeParse(assignedRaw);
  const search = (first(params.search) ?? "").trim().slice(0, 120);
  const date = z
    .string()
    .datetime({ offset: true })
    .safeParse(first(params.cursor_created_at) ?? "");
  const cursorIdResult = uuid.safeParse(first(params.cursor_id) ?? "");
  const cursor =
    date.success && cursorIdResult.success
      ? { createdAt: date.data, id: cursorIdResult.data }
      : null;
  const direction = first(params.direction) === "prev" ? "prev" : "next";
  const pageRaw = Number(first(params.page) ?? "1");
  const page = cursor && Number.isSafeInteger(pageRaw) && pageRaw > 1 ? Math.min(pageRaw, 5000) : 1;
  const selectedRaw = first(params.id);
  const selectedId = selectedRaw && uuid.safeParse(selectedRaw).success ? selectedRaw : null;
  const supabase = createClient(await cookies());
  const filters = {
    status: statusResult.success ? statusResult.data : null,
    source: sourceResult.success ? sourceResult.data : null,
    form: formResult.success ? formResult.data : null,
    assignedTo: assigned.success ? assigned.data : null,
    search,
  };
  const [auth, listResult, staffResult, sidebarCounters] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("admin_list_site_leads", {
      p_status: filters.status,
      p_source: filters.source,
      p_form: filters.form,
      p_assigned_to: filters.assignedTo,
      p_search: search || null,
      p_cursor_created_at: cursor?.createdAt ?? null,
      p_cursor_id: cursor?.id ?? null,
      p_direction: cursor ? direction : "next",
      p_limit: PAGE_SIZE + 1,
    }),
    supabase.rpc("admin_site_lead_staff"),
    getAdminSidebarCounters(supabase),
  ]);
  let detail: LeadDetail | null = null;
  let history: LeadEvent[] = [];
  let detailError = false;
  if (selectedId) {
    const [detailResult, historyResult] = await Promise.all([
      supabase.rpc("admin_site_lead_detail", { p_lead_id: selectedId }),
      supabase.rpc("admin_site_lead_history", { p_lead_id: selectedId }),
    ]);
    detail = detailResult.data?.[0] ?? null;
    history = historyResult.data ?? [];
    detailError = Boolean(detailResult.error || historyResult.error || !detail);
  }
  const raw = listResult.data ?? [];
  const rows = raw.slice(0, PAGE_SIZE) as LeadRow[];
  const hasNext = direction === "prev" ? page > 1 : raw.length > PAGE_SIZE;
  const firstRow = rows[0];
  const lastRow = rows[rows.length - 1];
  const pageInfo = {
    page,
    pageCount: page + Number(hasNext),
    hasNext,
    hasPrevious: page > 1,
    firstCursor: firstRow ? { createdAt: firstRow.created_at, id: firstRow.id } : null,
    lastCursor: lastRow ? { createdAt: lastRow.created_at, id: lastRow.id } : null,
  };
  const userId = auth.data.user?.id ?? null;
  const [{ data: profile }, { data: staff }] = await Promise.all([
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
  const userMeta = staff?.department
    ? `${t("sidebar.groups.admin")} · ${staff.department}`
    : t("sidebar.groups.admin");
  return (
    <InternalChrome
      role="admin"
      userName={userName}
      userMeta={userMeta}
      activeId="siteLeads"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={sidebarCounters}
    >
      <LeadsManager
        rows={rows}
        filters={filters}
        staff={staffResult.data ?? []}
        pageInfo={pageInfo}
        selected={detail}
        history={history}
        detailError={detailError}
        loadError={Boolean(listResult.error || staffResult.error)}
        locale={locale}
        onUpdate={updateLead}
        onAddNote={addLeadNote}
        onExport={exportLeads}
        onVerifyPin={verifyOperationPin}
      />
    </InternalChrome>
  );
}
