import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@upm/db/server";

import { AppChrome } from "../../components/AppChrome";
import {
  PROPERTY_STATUS_VALUES,
  PropertyListing,
  type PropertyListingRow,
  type PropertyRow,
} from "../../components/my-properties/PropertyListing";
import { setLocalePreference } from "../actions/preferences";
import { archiveProperty } from "../actions/property-listing";

export const dynamic = "force-dynamic";

function isPropertyStatus(value: string): value is PropertyRow["status"] {
  return (PROPERTY_STATUS_VALUES as readonly string[]).includes(value);
}

/**
 * "As minhas propriedades" (P4-03)
 * =========================================================================
 * Owner-only: o `middleware.ts` já bloqueia `/propriedades` a quem não é
 * `owner`, mas confirma-se outra vez aqui (08 §7.3 — defesa em profundidade,
 * nunca confiar só no middleware).
 *
 * Lê `properties` diretamente (não `properties_public`): o dono precisa de
 * ver `draft`/`pending_review`/`rejected`, que a view pública esconde. A RLS
 * de `properties` já deixa o dono ler as suas próprias linhas.
 */
export default async function MyPropertiesPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const supabase = createClient(await cookies());
  const [locale, { data: authData }] = await Promise.all([getLocale(), supabase.auth.getUser()]);
  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "owner") redirect("/");

  let query = supabase
    .from("properties")
    .select("*")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  if (estado && isPropertyStatus(estado)) {
    query = query.eq("status", estado);
  }

  const { data: properties } = await query;
  const list = properties ?? [];

  // Fotos de capa: bucket privado, sempre signed URL (nunca `getPublicUrl`).
  const rows: PropertyListingRow[] = await Promise.all(
    list.map(async (property) => {
      const { data: media } = await supabase
        .from("property_media")
        .select("path")
        .eq("property_id", property.id)
        .order("is_cover", { ascending: false })
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!media) return { ...property, coverUrl: null };

      const { data: signed } = await supabase.storage
        .from("property-media")
        .createSignedUrl(media.path, 3600);

      return { ...property, coverUrl: signed?.signedUrl ?? null };
    }),
  );

  return (
    <AppChrome
      role="owner"
      userName={profile.full_name || "Proprietário"}
      userMeta="Proprietário"
      activeId="myProperties"
      locale={locale}
      onLocaleChange={setLocalePreference}
    >
      <PropertyListing rows={rows} statusValue={estado ?? ""} onArchive={archiveProperty} />
    </AppChrome>
  );
}
