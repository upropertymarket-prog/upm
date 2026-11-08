// Só se importa a partir de Server Actions e rotas (`"use server"`): usa a
// chave de serviço, e nunca pode entrar num componente de cliente.
import { getTranslations } from "next-intl/server";
import { createServiceClient } from "@upm/db/server";

/**
 * Recuperação de acesso da equipa (8 nov 2026)
 * =========================================================================
 * Decisão do cliente, depois de pesar os códigos de recuperação:
 *
 *  - **Palavra-passe perdida.** Um admin usa "Esqueci-me da palavra-passe" no
 *    ecrã de entrada. O resto da equipa pede a um admin, que lhe envia o link
 *    em Admin › Utilizadores. Em ambos os casos o link vai para o e-mail do
 *    próprio: o admin nunca fica a saber a palavra-passe de ninguém.
 *  - **Telemóvel perdido** (a app da 2FA). Um admin repõe a 2FA dessa pessoa,
 *    que volta a ler um QR na entrada seguinte. Os 10 códigos de recuperação
 *    saíram: com dois admins, cada um repõe o do outro, e o último recurso é o
 *    painel do Supabase (Authentication › Users › fatores).
 *
 * **Repor a palavra-passe não abre a porta.** Depois de a mudar, a entrada
 * continua a pedir o código da app. Quem tomar conta do e-mail de alguém da
 * equipa consegue mudar-lhe a palavra-passe e fica parado no ecrã do código.
 *
 * **O link não passa pelo e-mail do Supabase Auth.** Gera-se com a API de
 * administração (\`generateLink\`, que não envia nada) e vai pela mesma fila
 * dos outros e-mails (\`notification_deliveries\` › Edge Function \`outbox\` ›
 * Resend). Assim não depende do SMTP do Auth (F1), que só se configura no
 * lançamento oficial.
 */

export const STAFF_ROLES = ["admin", "support", "marketing"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

const TEMPLATE = "staff_password_recovery";

function internoUrl(): string {
  return (process.env.INTERNO_URL ?? "http://localhost:4302").replace(/\/+$/, "");
}

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

/**
 * Gera o link de recuperação de uma conta e põe-no na fila de e-mails.
 *
 * Para o "Esqueci-me" do ecrã de entrada, que só serve admins: devolve
 * \`false\` sem enviar nada quando o e-mail não é de um admin ativo, e quem
 * chamou responde o mesmo nos dois casos — quem experimente e-mails ao acaso
 * não fica a saber quem é admin.
 */
export async function sendRecoveryLink(
  email: string,
  options: { onlyIfRole?: readonly StaffRole[] } = {},
): Promise<boolean> {
  const service = createServiceClient();
  const { data, error } = await service.auth.admin.generateLink({ type: "recovery", email });
  if (error || !data.user || !data.properties?.hashed_token) return false;

  const profile = await staffProfile(data.user.id);
  if (!profile || profile.status !== "active") return false;
  if (options.onlyIfRole && !options.onlyIfRole.includes(profile.role)) return false;

  const link = `${internoUrl()}/auth/confirmar?token_hash=${encodeURIComponent(
    data.properties.hashed_token,
  )}&type=recovery`;

  // Um pedido novo invalida o anterior (o Supabase guarda um token por conta):
  // uma entrega ainda em fila levaria um link morto, por isso cancela-se.
  await service
    .from("notification_deliveries")
    .update({ status: "cancelled" })
    .eq("recipient", profile.email)
    .eq("template", TEMPLATE)
    .eq("status", "queued");

  // O interno é em português: o e-mail também, pelo dicionário como o resto.
  const t = await getTranslations({ locale: "pt", namespace: "auth.staffRecovery.emailMessage" });
  const { error: insertError } = await service.from("notification_deliveries").insert({
    channel: "email",
    profile_id: profile.id,
    recipient: profile.email,
    template: TEMPLATE,
    payload: {
      title: t("title"),
      body: t("body"),
      link,
      cta: t("cta"),
      footer: t("footer"),
      lang: "pt",
    },
  });
  return !insertError;
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
 * Grava a palavra-passe nova a partir da sessão do link de recuperação.
 * ---------------------------------------------------------------------------
 * **Pela API de administração, e não pelo `updateUser` da sessão.** O
 * Supabase recusa mudar a palavra-passe a uma conta com 2FA a partir de uma
 * sessão `aal1` — e a do link é `aal1`. Visto no E2E a 8 nov 2026.
 *
 * **Só se a sessão nasceu de um link do e-mail, há pouco.** Sem isto, quem
 * soubesse a palavra-passe de alguém da equipa entrava (`aal1`), ia a
 * `/nova-palavra-passe` e trocava-a sem nunca passar pela 2FA.
 *
 * O Supabase marca a sessão do `verifyOtp({ type: "recovery" })` com
 * `amr: [{ method: "otp" }]`, e não `recovery` (medido a 8 nov 2026). `otp`
 * é também o método de um link mágico — que pede, como o de recuperação, a
 * caixa de correio da pessoa: a mesma prova. Uma sessão de palavra-passe
 * (`password`) nunca passa. E só nos primeiros `RECOVERY_WINDOW_SECONDS`: uma
 * sessão do link esquecida aberta não fica a servir para isto.
 */
export const RECOVERY_WINDOW_SECONDS = 15 * 60;
const EMAIL_LINK_METHODS = ["otp", "recovery"];

export async function setPasswordFromRecoverySession(
  claims:
    | { sub?: string; amr?: Array<string | { method?: string; timestamp?: number }> }
    | null
    | undefined,
  password: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<"ok" | "not_recovery" | "failed"> {
  // O `amr` vem como lista de métodos ou de entradas `{ method, timestamp }`,
  // consoante a versão do Auth. Só a forma com data diz *quando*: a outra não
  // chega para provar que o link é recente.
  const doLink = (claims?.amr ?? []).some(
    (entry) =>
      typeof entry === "object" &&
      EMAIL_LINK_METHODS.includes(entry.method ?? "") &&
      typeof entry.timestamp === "number" &&
      nowSeconds - entry.timestamp <= RECOVERY_WINDOW_SECONDS,
  );
  if (!claims?.sub || !doLink) return "not_recovery";
  const profile = await staffProfile(claims.sub);
  if (!profile) return "not_recovery";
  const service = createServiceClient();
  const { error } = await service.auth.admin.updateUserById(claims.sub, { password });
  return error ? "failed" : "ok";
}

/**
 * A saída de alguém da equipa (decisão do cliente, 8 nov 2026)
 * =========================================================================
 * 1. **Bloqueia-se de imediato:** o estado passa a "Suspenso" (o middleware
 *    termina a sessão no pedido seguinte; o link de recuperação deixa de sair).
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
