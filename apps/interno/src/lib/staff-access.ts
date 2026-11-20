// Só se importa a partir de Server Actions e rotas (`"use server"`): usa a
// chave de serviço, e nunca pode entrar num componente de cliente.
import { createServiceClient } from "@upm/db/server";

/**
 * Acesso da equipa — quem decide é a administração (20 nov 2026)
 * =========================================================================
 * Decisão do cliente: a app é da empresa, e são os admins que decidem quem
 * tem acesso.
 *
 *  - **Palavra-passe.** Ninguém da equipa define nem recupera a própria — nem
 *    os admins. Muda-a um admin, em Admin › Equipa, sempre que achar preciso;
 *    a de um admin muda-a o outro. Não há "Esqueci-me" nem link por e-mail
 *    (o caminho de 8 nov saiu). A regra vive na base
 *    (`admin_set_staff_password` e o gatilho de `auth.users`, migração
 *    20261120130000): nem o Supabase Auth a contorna.
 *  - **Telemóvel perdido** (a app da 2FA). Um admin repõe a 2FA dessa pessoa,
 *    que volta a ler um QR na entrada seguinte. Sem códigos de recuperação:
 *    com dois admins, cada um repõe o do outro, e o último recurso é o painel
 *    do Supabase (Authentication › Users › fatores).
 *
 * **Mudar a palavra-passe não abre a porta.** A entrada continua a pedir o
 * código da app: quem souber a palavra-passe de outra pessoa fica parado no
 * ecrã do código.
 */

export const STAFF_ROLES = ["admin", "support", "marketing"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

/** O perfil de equipa de uma conta, ou \`null\` se não for de equipa. */
export async function staffProfile(
  userId: string,
): Promise<{ id: string; role: StaffRole; status: string; email: string } | null> {
  const service = createServiceClient();
  const [{ data: profile }, { data: auth }] = await Promise.all([
    service.from("profiles").select("id, role, status").eq("id", userId).maybeSingle(),
    service.auth.admin.getUserById(userId),
  ]);
  const email = auth.user?.email;
  if (!profile || !email) return null;
  if (!(STAFF_ROLES as readonly string[]).includes(profile.role)) return null;
  return { id: profile.id, role: profile.role as StaffRole, status: profile.status, email };
}

/** Remove a 2FA de uma conta: na entrada seguinte, a pessoa lê um QR novo. */
export async function resetStaffMfa(userId: string): Promise<boolean> {
  const service = createServiceClient();
  const { data, error } = await service.auth.admin.mfa.listFactors({ userId });
  if (error) return false;
  for (const factor of data.factors) {
    const { error: deleteError } = await service.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId,
    });
    if (deleteError) return false;
  }
  return true;
}

/**
 * A saída de alguém da equipa (decisão do cliente, 8 nov 2026)
 * =========================================================================
 * 1. **Bloqueia-se de imediato:** o estado passa a "Suspenso" (o middleware
 *    termina a sessão no pedido seguinte).
 * 2. **Passa-se o trabalho a outra pessoa:** os leads em aberto e as caixas
 *    de correio atribuídos. Enquanto houver algum, a conta não se elimina
 *    (`staffExitBlockers`).
 * 3. **Guarda-se fora o que tiver de ser guardado:** o registo da pessoa sai
 *    num CSV (`staffRecordCsv`) que a administração descarrega e guarda.
 * 4. **Elimina-se a conta.** Não fica no sistema: o perfil e o login saem, e
 *    nos registos que ficam — o que fez, o que consultou, o que moderou — o
 *    autor passa a null (migração 20261108090000).
 */
export type StaffExitBlockers = { openLeads: number; mailboxes: number };

export async function staffExitBlockers(userId: string): Promise<StaffExitBlockers | null> {
  const service = createServiceClient();
  const [leads, mailboxes] = await Promise.all([
    service
      .from("site_leads")
      .select("id", { count: "exact", head: true })
      .eq("assigned_to", userId)
      .in("status", ["new", "contacted", "qualified"]),
    service
      .from("mailboxes")
      .select("id", { count: "exact", head: true })
      .eq("owner_profile_id", userId),
  ]);
  if (leads.error || mailboxes.error) return null;
  return { openLeads: leads.count ?? 0, mailboxes: mailboxes.count ?? 0 };
}

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}

const RECORD_PAGE = 1000;
/** Teto por registo: uma conta da equipa com mais do que isto é um caso a ver à mão. */
const RECORD_CAP = 50_000;

async function allRows<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[] | null> {
  const rows: T[] = [];
  for (let from = 0; from < RECORD_CAP; from += RECORD_PAGE) {
    const { data, error } = await page(from, from + RECORD_PAGE - 1);
    if (error || !data) return null;
    rows.push(...data);
    if (data.length < RECORD_PAGE) break;
  }
  return rows;
}

/**
 * O registo de uma pessoa da equipa, num CSV, para guardar fora do sistema.
 * ---------------------------------------------------------------------------
 * Uma linha por acontecimento, com a origem na primeira coluna: a conta (quem
 * era), o `audit_log` (o que mudou), o `personal_data_access_log` (de quem
 * abriu dados), a moderação de imóveis e o trabalho nos leads do site.
 * Depois da eliminação, estes registos ficam na base sem autor; o CSV é a
 * única ligação entre eles e a pessoa.
 */
export async function staffRecordCsv(userId: string): Promise<string | null> {
  const service = createServiceClient();
  const profile = await staffProfile(userId);
  if (!profile) return null;
  const { data: details } = await service
    .from("profiles")
    .select("full_name, created_at")
    .eq("id", userId)
    .maybeSingle();

  const [audit, access, moderation, leads] = await Promise.all([
    allRows((from, to) =>
      service
        .from("audit_log")
        .select("created_at, action, entity, entity_id, diff")
        .eq("actor_id", userId)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    allRows((from, to) =>
      service
        .from("personal_data_access_log")
        .select("occurred_at, action, subject_type, subject_id")
        .eq("actor_profile_id", userId)
        .order("occurred_at")
        .order("id")
        .range(from, to),
    ),
    allRows((from, to) =>
      service
        .from("property_moderation_events")
        .select("created_at, action, property_id, status_from, status_to, reason")
        .eq("actor_id", userId)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
    allRows((from, to) =>
      service
        .from("site_lead_events")
        .select("created_at, kind, lead_id, body")
        .eq("actor_id", userId)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
  ]);
  if (!audit || !access || !moderation || !leads) return null;

  const header = ["origem", "data", "acao", "entidade", "entidade_id", "detalhe"];
  const rows: unknown[][] = [
    [
      "conta",
      details?.created_at ?? "",
      profile.role,
      "profiles",
      profile.id,
      JSON.stringify({ nome: details?.full_name ?? "", email: profile.email }),
    ],
    ...audit.map((r) => [
      "audit_log",
      r.created_at,
      r.action,
      r.entity,
      r.entity_id,
      JSON.stringify(r.diff ?? {}),
    ]),
    ...access.map((r) => [
      "consulta_de_dados",
      r.occurred_at,
      r.action,
      r.subject_type,
      r.subject_id,
      "",
    ]),
    ...moderation.map((r) => [
      "moderacao",
      r.created_at,
      r.action,
      "properties",
      r.property_id,
      JSON.stringify({ de: r.status_from, para: r.status_to, motivo: r.reason }),
    ]),
    ...leads.map((r) => ["lead_do_site", r.created_at, r.kind, "site_leads", r.lead_id, r.body]),
  ];
  return [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
}

/** Elimina o login e o perfil (o resto sai em cascata ou fica sem autor). */
export async function deleteStaffUser(userId: string): Promise<boolean> {
  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(userId);
  return !error;
}

/** Janela entre descarregar o registo e eliminar a conta. */
export const RECORD_EXPORT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Se o registo desta pessoa saiu em CSV há menos de `RECORD_EXPORT_WINDOW_MS`. */
export async function recordExportedRecently(userId: string, now = Date.now()): Promise<boolean> {
  const service = createServiceClient();
  const { count, error } = await service
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("action", "staff.record_export")
    .eq("entity_id", userId)
    .gte("created_at", new Date(now - RECORD_EXPORT_WINDOW_MS).toISOString());
  return !error && (count ?? 0) > 0;
}
