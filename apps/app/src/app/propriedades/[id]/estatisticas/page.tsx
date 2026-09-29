import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { Card, Table, type TableColumn } from "@upm/ui";

import { AppChrome } from "../../../../components/AppChrome";
import { setLocalePreference } from "../../../actions/preferences";

export const dynamic = "force-dynamic";

type ViewRow = { id: string; day: string; views_count: number };

/**
 * Estatísticas de um imóvel próprio (P4-03) — série diária de `property_views`.
 * A RLS já restringe a leitura a dono/staff; confirma-se a posse outra vez
 * aqui com uma query direta a `properties` pelo dono (08 §7.3).
 */
export default async function PropertyStatsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const { data: property } = await supabase
    .from("properties")
    .select("id, title")
    .eq("id", id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (!property) notFound();

  const { data: views } = await supabase
    .from("property_views")
    .select("id, day, views_count")
    .eq("property_id", id)
    .order("day", { ascending: false })
    .limit(30);

  const rows: ViewRow[] = views ?? [];

  const columns: TableColumn<ViewRow>[] = [
    { id: "day", header: "Dia", cell: (row) => row.day },
    { id: "views", header: "Visitas", numeric: true, cell: (row) => row.views_count },
  ];

  return (
    <AppChrome
      role="owner"
      userName={profile.full_name || "Proprietário"}
      userMeta="Proprietário"
      activeId="myProperties"
      locale={locale}
      onLocaleChange={setLocalePreference}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <h1 className="upm-card__title">Estatísticas — {property.title}</h1>
        <Card>
          <Table
            caption={`Visitas diárias — ${property.title}`}
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            empty="Ainda sem visitas registadas."
          />
        </Card>
      </div>
    </AppChrome>
  );
}
