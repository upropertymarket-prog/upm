import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import type { Database } from "@upm/db";
import { createClient } from "@upm/db/server";

import { InternalChrome } from "../../../components/InternalChrome";
import { setLocalePreference } from "../../actions/preferences";
import { verifyOperationPin } from "../../actions/step-up";
import { moderateProperty } from "./actions";
import { ModerationView } from "./ModerationView";
import { getAdminSidebarCounters } from "../../../lib/admin-shell";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;
const statuses = ["pending_review", "active", "rejected", "featured"] as const;
const statusSchema = z.enum(statuses);
const idSchema = z.string().uuid();
const cursorDateSchema = z.string().datetime({ offset: true });

type PropertyStatus = Database["public"]["Enums"]["property_status"];
type ListRow = Database["public"]["Functions"]["admin_list_moderation"]["Returns"][number];
type RawDetailRow = Database["public"]["Functions"]["admin_moderation_detail"]["Returns"][number];
type DetailRow = Omit<RawDetailRow, "owner_id">;
type HistoryRow =
  Database["public"]["Functions"]["admin_property_moderation_history"]["Returns"][number];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function exactLocationLabel(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return null;

  const coordinates = (value as { coordinates?: unknown }).coordinates;
  if (Array.isArray(coordinates) && coordinates.every((item) => typeof item === "number")) {
    return coordinates.join(", ");
  }
  return JSON.stringify(value);
}

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const parsedStatus = statusSchema.safeParse(first(params.status) ?? "pending_review");
  const status = parsedStatus.success ? parsedStatus.data : "pending_review";
  const cursorCreatedRaw = first(params.cursor_created_at) ?? "";
  const cursorIdRaw = first(params.cursor_id) ?? "";
  const cursorDate = cursorDateSchema.safeParse(cursorCreatedRaw);
  const cursorId = idSchema.safeParse(cursorIdRaw);
  const cursor =
    cursorDate.success && cursorId.success
      ? { createdAt: cursorDate.data, id: cursorId.data }
      : null;
  const direction = first(params.direction) === "prev" ? "prev" : "next";
  const rawPage = Number(first(params.page) ?? "1");
  const page = cursor && Number.isSafeInteger(rawPage) && rawPage > 1 ? Math.min(rawPage, 5000) : 1;
  const selectedIdRaw = first(params.id);
  const selectedId =
    selectedIdRaw && idSchema.safeParse(selectedIdRaw).success ? selectedIdRaw : null;

  const supabase = createClient(await cookies());
  const [authResult, listResult, countsResult, sidebarCounters] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("admin_list_moderation", {
      p_status: status as PropertyStatus,
      p_cursor_created_at: cursor?.createdAt,
      p_cursor_id: cursor?.id,
      p_direction: cursor ? direction : "next",
      p_limit: PAGE_SIZE + 1,
    }),
    supabase.rpc("admin_moderation_counts"),
    getAdminSidebarCounters(supabase),
  ]);

  let detailResult: { data: RawDetailRow[] | null; error: unknown } | null = null;
  let mediaResult: {
    data: Array<{
      id: string;
      path: string;
      kind: string;
      position: number;
      is_cover: boolean;
    }> | null;
    error: unknown;
  } | null = null;
  let documentsResult: {
    data: Array<{
      id: string;
      name: string;
      mime: string;
      size: number;
      kind: string;
      storage_path: string;
    }> | null;
    error: unknown;
  } | null = null;
  let historyResult: { data: HistoryRow[] | null; error: unknown } | null = null;
  let locationResult: { data: unknown; error: unknown } | null = null;

  if (selectedId) {
    [detailResult, mediaResult, documentsResult, historyResult, locationResult] = await Promise.all(
      [
        supabase.rpc("admin_moderation_detail", { p_property_id: selectedId }),
        supabase
          .from("property_media")
          .select("id, path, kind, position, is_cover")
          .eq("property_id", selectedId)
          .order("position", { ascending: true }),
        supabase
          .from("property_documents")
          .select("id, name, mime, size, kind, storage_path")
          .eq("property_id", selectedId)
          .order("created_at", { ascending: false }),
        supabase.rpc("admin_property_moderation_history", { p_property_id: selectedId }),
        supabase.rpc("get_property_location", { p_property_id: selectedId }),
      ],
    );
  }

  const rawDetails = detailResult?.data?.[0] ?? null;
  const details: DetailRow | null = rawDetails
    ? (({ owner_id, ...detail }) => {
        void owner_id;
        return detail;
      })(rawDetails)
    : null;
  const mediaRows = mediaResult?.data ?? [];
  const documentRows = documentsResult?.data ?? [];
  const [signedMediaResult, signedDocumentsResult] = await Promise.all([
    mediaRows.length > 0
      ? supabase.storage.from("property-media").createSignedUrls(
          mediaRows.map((row) => row.path),
          600,
        )
      : Promise.resolve({ data: [], error: null }),
    documentRows.length > 0
      ? supabase.storage.from("documents").createSignedUrls(
          documentRows.map((row) => row.storage_path),
          300,
        )
      : Promise.resolve({ data: [], error: null }),
  ]);

  const media = mediaRows.map((row, index) => ({
    id: row.id,
    kind: row.kind,
    position: row.position,
    is_cover: row.is_cover,
    signedUrl: signedMediaResult.data?.[index]?.signedUrl ?? null,
  }));
  const documents = documentRows.map((row, index) => ({
    id: row.id,
    name: row.name,
    mime: row.mime,
    size: row.size,
    kind: row.kind,
    signedUrl: signedDocumentsResult.data?.[index]?.signedUrl ?? null,
  }));

  const rawRows = (listResult.data ?? []) as ListRow[];
  const hasMoreForward = direction === "next" && rawRows.length > PAGE_SIZE;
  const pageRows = rawRows.slice(0, PAGE_SIZE);
  const coverPaths = pageRows.flatMap((row) => (row.cover_path ? [row.cover_path] : []));
  const coverResult = coverPaths.length
    ? await supabase.storage.from("property-media").createSignedUrls(coverPaths, 600)
    : { data: [], error: null };
  let coverIndex = 0;
  const properties = pageRows.map((row) => {
    const { cover_path, ...property } = row;
    return {
      ...property,
      coverUrl: cover_path ? (coverResult.data?.[coverIndex++]?.signedUrl ?? null) : null,
    };
  });
  const firstRow = properties[0];
  const lastRow = properties[properties.length - 1];
  const firstCursor = firstRow ? { createdAt: firstRow.created_at, id: firstRow.id } : null;
  const lastCursor = lastRow ? { createdAt: lastRow.created_at, id: lastRow.id } : null;
  const hasNext = direction === "prev" ? page > 1 : hasMoreForward;
  const pageInfo = {
    page,
    pageCount: page + Number(hasNext),
    hasNext,
    hasPrevious: page > 1,
    firstCursor,
    lastCursor,
  };

  const profileId = authResult.data.user?.id ?? null;
  const [{ data: chromeProfile }, { data: staff }] = await Promise.all([
    profileId
      ? supabase.from("profiles").select("full_name, locale").eq("id", profileId).maybeSingle()
      : Promise.resolve({ data: null }),
    profileId
      ? supabase
          .from("staff_members")
          .select("department")
          .eq("profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const t = await getTranslations();
  const locale = chromeProfile?.locale ?? "pt";
  const userName = chromeProfile?.full_name?.trim() || authResult.data.user?.email || "—";
  const userMeta = staff?.department
    ? t("sidebar.groups.admin") + " · " + String(staff.department)
    : t("sidebar.groups.admin");

  const counts: Record<string, number> = {};
  for (const item of countsResult.data ?? []) counts[item.status] = Number(item.total);

  const detailError = Boolean(
    selectedId &&
    (!details ||
      detailResult?.error ||
      mediaResult?.error ||
      documentsResult?.error ||
      historyResult?.error ||
      locationResult?.error ||
      coverResult.error),
  );

  return (
    <InternalChrome
      role="admin"
      userName={userName}
      userMeta={userMeta}
      activeId="propertyModeration"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={sidebarCounters}
    >
      <ModerationView
        status={status}
        properties={properties}
        counts={counts}
        pageInfo={pageInfo}
        selectedProperty={details}
        media={media}
        documents={documents}
        history={historyResult?.data ?? []}
        exactLocation={exactLocationLabel(locationResult?.data)}
        selectedPropertyError={detailError}
        loadError={Boolean(listResult.error || countsResult.error)}
        locale={locale}
        onModerate={moderateProperty}
        onVerifyPin={verifyOperationPin}
      />
    </InternalChrome>
  );
}
