import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { Database } from "@upm/db";
import { createClient } from "@upm/db/server";

import { InternalChrome } from "../../../components/InternalChrome";
import { setLocalePreference } from "../../actions/preferences";
import { verifyOperationPin } from "../../actions/step-up";
import {
  deleteStaffAccount,
  exportStaffRecord,
  recordProfileAccess,
  setProfileStatus,
  resetStaffPassword,
  resetStaffTwoFactor,
} from "./actions";
import {
  UsersManager,
  type DirectoryAudience,
  type UserCursor,
  type UserDirectoryRow,
} from "./UsersManager";
import { getAdminSidebarCounters } from "../../../lib/admin-shell";

const PAGE_SIZE = 25;
// `marketing` entrou com P10-07, quando a área nasceu (07 §24.6). Sem ele aqui,
// o filtro de papel do diretório recusava em silêncio a opção que o ecrã
// oferece.
const ROLE_SCHEMA: Record<DirectoryAudience, z.ZodType<Role>> = {
  clients: z.enum(["buyer", "owner"]),
  staff: z.enum(["admin", "support", "marketing"]),
};
const STAFF_ROLES: ReadonlySet<Role> = new Set(["admin", "support", "marketing"]);
const statusSchema = z.enum(["pending", "active", "suspended"]);
const uuidSchema = z.string().uuid();
const dateSchema = z.string().datetime({ offset: true });

type Role = Database["public"]["Enums"]["user_role"];
type ProfileStatus = Database["public"]["Enums"]["profile_status"];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseQuery(
  params: Record<string, string | string[] | undefined>,
  audience: DirectoryAudience,
) {
  const rawRole = first(params.role) ?? "";
  const rawStatus = first(params.status) ?? "";
  const rawPlan = first(params.plan) ?? "";
  const rawSearch = first(params.search) ?? "";
  const rawCursorDate = first(params.cursor_created_at) ?? "";
  const rawCursorId = first(params.cursor_id) ?? "";
  const rawDirection = first(params.direction) ?? "next";
  const rawPage = Number(first(params.page) ?? "1");

  // Um papel do outro público no URL é ignorado, não obedecido.
  const role = ROLE_SCHEMA[audience].safeParse(rawRole);
  const status = statusSchema.safeParse(rawStatus);
  const plan = uuidSchema.safeParse(rawPlan);
  const cursorDate = dateSchema.safeParse(rawCursorDate);
  const cursorId = uuidSchema.safeParse(rawCursorId);
  const hasValidCursor = cursorDate.success && cursorId.success;
  const direction = rawDirection === "prev" ? "prev" : "next";

  return {
    filters: {
      search: rawSearch.trim().slice(0, 120),
      role: role.success ? role.data : "",
      status: status.success ? status.data : "",
      planId: plan.success ? plan.data : "",
    },
    cursor: hasValidCursor ? { createdAt: cursorDate.data, id: cursorId.data } : null,
    direction: hasValidCursor ? direction : "next",
    page: hasValidCursor && Number.isInteger(rawPage) && rawPage > 1 ? Math.min(rawPage, 5000) : 1,
  };
}

/**
 * O diretório do Admin, para um público de cada vez (14 nov 2026): **clientes**
 * em `/admin/utilizadores` e **equipa interna** em `/admin/equipa`. A
 * separação é feita na função da base (`p_audience`), não no ecrã — filtrar
 * depois de paginar deixava páginas mais curtas e cursores errados.
 */
export async function DirectoryPage({
  searchParams,
  audience,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  audience: DirectoryAudience;
}) {
  const params = await searchParams;
  const parsed = parseQuery(params, audience);
  const supabase = createClient(await cookies());

  const [authResult, listResult, plansResult, counters] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("admin_list_profiles", {
      p_search: parsed.filters.search || undefined,
      p_role: parsed.filters.role ? (parsed.filters.role as Role) : undefined,
      p_status: parsed.filters.status ? (parsed.filters.status as ProfileStatus) : undefined,
      p_plan_id: parsed.filters.planId || undefined,
      p_cursor_created_at: parsed.cursor?.createdAt,
      p_cursor_id: parsed.cursor?.id,
      p_direction: parsed.direction,
      p_limit: PAGE_SIZE + 1,
      p_audience: audience,
    }),
    supabase.from("plans").select("id, name").order("position"),
    getAdminSidebarCounters(supabase),
  ]);

  // The selected drawer query runs separately only when there is a validated id.
  const selectedIdRaw = first(params.id);
  const selectedId =
    selectedIdRaw && uuidSchema.safeParse(selectedIdRaw).success ? selectedIdRaw : null;
  const selectedResult = selectedId
    ? await supabase.rpc("admin_profile_detail", { p_profile_id: selectedId })
    : null;

  const profileId = authResult.data.user?.id ?? null;
  const { data: chromeProfile } = profileId
    ? await supabase.from("profiles").select("full_name, locale").eq("id", profileId).maybeSingle()
    : { data: null };
  const { data: staff } = profileId
    ? await supabase
        .from("staff_members")
        .select("department")
        .eq("profile_id", profileId)
        .maybeSingle()
    : { data: null };

  const rawRows = listResult.data ?? [];
  const hasMoreForward = parsed.direction === "next" && rawRows.length > PAGE_SIZE;
  const users = rawRows.slice(0, PAGE_SIZE) as UserDirectoryRow[];
  // Um id de outro público abre nada: a ficha de um cliente não aparece na
  // página da equipa, nem o contrário.
  const selectedRow = selectedResult?.data?.[0] ?? null;
  const selectedProfile =
    selectedRow && STAFF_ROLES.has(selectedRow.role) === (audience === "staff")
      ? selectedRow
      : null;
  const firstRow = users[0];
  const lastRow = users[users.length - 1];
  const firstCursor: UserCursor | null = firstRow
    ? { createdAt: firstRow.created_at, id: firstRow.id }
    : null;
  const lastCursor: UserCursor | null = lastRow
    ? { createdAt: lastRow.created_at, id: lastRow.id }
    : null;
  const hasNext = parsed.direction === "prev" ? parsed.page > 1 : hasMoreForward;
  const pageInfo = {
    page: parsed.page,
    pageCount: parsed.page + Number(hasNext),
    hasNext,
    hasPrevious: parsed.page > 1,
    firstCursor,
    lastCursor,
  };

  const t = await getTranslations();
  const locale = chromeProfile?.locale ?? "pt";
  const department = staff?.department ? String(staff.department) : null;
  const userName = chromeProfile?.full_name?.trim() || authResult.data.user?.email || "—";
  const userMeta = department
    ? t("sidebar.groups.admin") + " · " + department
    : t("sidebar.groups.admin");

  return (
    <InternalChrome
      role="admin"
      userName={userName}
      userMeta={userMeta}
      activeId={audience === "staff" ? "team" : "users"}
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={counters}
    >
      <UsersManager
        audience={audience}
        users={users}
        plans={(plansResult.data ?? []).map((plan) => ({ id: plan.id, name: plan.name }))}
        filters={parsed.filters}
        pageInfo={pageInfo}
        selectedProfile={selectedProfile}
        selectedProfileError={Boolean(selectedId && (selectedResult?.error || !selectedProfile))}
        loadError={Boolean(listResult.error || plansResult.error)}
        locale={locale}
        currentAdminId={profileId}
        onChangeStatus={setProfileStatus}
        onLogAccess={recordProfileAccess}
        onVerifyPin={verifyOperationPin}
        onResetPassword={resetStaffPassword}
        onResetTwoFactor={resetStaffTwoFactor}
        onExportRecord={exportStaffRecord}
        onDeleteAccount={deleteStaffAccount}
      />
    </InternalChrome>
  );
}
