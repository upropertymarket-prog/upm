"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Database } from "@upm/db";
import { createClient } from "@upm/db/server";
import { isStepUpRequiredError } from "@upm/db/auth";

const idSchema = z.string().uuid();
const updateSchema = z.object({
  leadId: idSchema,
  status: z.enum(["new", "contacted", "qualified", "converted", "discarded"]),
  assignedTo: idSchema.nullable(),
});
const noteSchema = z.object({ leadId: idSchema, note: z.string().trim().min(1).max(2000) });
const filtersSchema = z.object({
  status: z.enum(["new", "contacted", "qualified", "converted", "discarded"]).nullable(),
  source: z.enum(["pre_launch", "post_launch"]).nullable(),
  form: z.enum(["preinscricao", "contacto", "empresas"]).nullable(),
  assignedTo: idSchema.nullable(),
  search: z.string().max(120),
});

export type LeadActionResult = { ok?: boolean; needsStepUp?: boolean; error?: string };
export type LeadFilters = z.infer<typeof filtersSchema>;

async function getAdminClient() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return profile?.role === "admin" ? supabase : null;
}

export async function updateLead(input: unknown): Promise<LeadActionResult> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid lead update." };
  const supabase = await getAdminClient();
  if (!supabase) return { error: "Not authorized." };
  const { error } = await supabase.rpc("admin_update_site_lead", {
    p_lead_id: parsed.data.leadId,
    p_status: parsed.data.status,
    // `p_assigned_to` não tem DEFAULT na função, por isso os tipos gerados
    // pedem `string` — mas o corpo SQL trata `null` como "desatribuir"
    // (`20261002130200_site_leads.sql`), e é isso que o cast diz. Mesmo padrão
    // do `p_folder_id` da Cloud.
    p_assigned_to: (parsed.data.assignedTo ?? null) as unknown as string,
  });
  if (error) return { error: "Could not update the lead." };
  revalidatePath("/admin/leads-site");
  revalidatePath("/admin/painel");
  return { ok: true };
}

export async function addLeadNote(input: unknown): Promise<LeadActionResult> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid note." };
  const supabase = await getAdminClient();
  if (!supabase) return { error: "Not authorized." };
  const { error } = await supabase.rpc("admin_add_site_lead_note", {
    p_lead_id: parsed.data.leadId,
    p_note: parsed.data.note,
  });
  if (error) return { error: "Could not save the note." };
  revalidatePath("/admin/leads-site");
  return { ok: true };
}

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

/** Teto de `admin_export_site_leads` (20261002130200) e o `max_rows` do PostgREST. */
const EXPORT_CAP = 5000;
const EXPORT_PAGE = 1000;

type ExportRow = Database["public"]["Functions"]["admin_export_site_leads"]["Returns"][number];

export async function exportLeads(
  input: unknown,
): Promise<LeadActionResult & { csv?: string; truncated?: boolean }> {
  const parsed = filtersSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid export filters." };
  const supabase = await getAdminClient();
  if (!supabase) return { error: "Not authorized." };
  const { error: pinError } = await supabase.rpc("require_step_up");
  if (pinError)
    return isStepUpRequiredError(pinError)
      ? { needsStepUp: true }
      : { error: "PIN confirmation failed." };
  const filters = parsed.data;
  // Por páginas. O PostgREST corta qualquer resposta às 1000 linhas
  // (`max_rows`), também a de um RPC, e sem aviso: até 3 nov 2026, o CSV
  // saía com os primeiros 1000 leads e parecia completo. A função tem o seu
  // próprio teto, 5000, e ordena por `created_at desc, id desc` — a ordem
  // estável é o que torna as páginas consistentes.
  const data: ExportRow[] = [];
  for (let from = 0; from < EXPORT_CAP; from += EXPORT_PAGE) {
    const { data: pagina, error } = await supabase
      .rpc("admin_export_site_leads", {
        p_status: filters.status ?? undefined,
        p_source: filters.source ?? undefined,
        p_form: filters.form ?? undefined,
        p_assigned_to: filters.assignedTo ?? undefined,
        p_search: filters.search || undefined,
      })
      .range(from, from + EXPORT_PAGE - 1);
    if (error || !pagina) return { error: "Could not export leads." };
    data.push(...pagina);
    if (pagina.length < EXPORT_PAGE) break;
  }
  // No teto, há quase de certeza mais: diz-se, em vez de entregar um ficheiro
  // que parece completo.
  const truncated = data.length >= EXPORT_CAP;
  const audit = await supabase.rpc("write_audit_log", {
    p_action: "site_leads.export",
    p_entity: "site_leads",
    p_diff: { filters, exported_count: data.length, limit: EXPORT_CAP, truncated },
  });
  if (audit.error) return { error: "The export could not be audited." };
  const headers = [
    "source",
    "form",
    "name",
    "email",
    "phone",
    "profile_type",
    "reason",
    "message",
    "utm",
    "status",
    "assigned_name",
    "consent_marketing",
    "consent_at",
    "created_at",
  ];
  const rows = data.map((row) =>
    headers
      .map((key) => csvCell(key === "utm" ? JSON.stringify(row.utm) : row[key as keyof typeof row]))
      .join(","),
  );
  return { ok: true, csv: [headers.join(","), ...rows].join("\r\n"), truncated };
}
