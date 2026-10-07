import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Suporte: tickets e captura técnica (Fase 10 · Parte 1 — P10-01)
 * =========================================================================
 * A única via da aplicação até `report_problem()`. Três regras moram aqui, e
 * não nos ecrãs:
 *
 * 1. **O `fingerprint` é calculado no servidor**, nunca recebido do cliente.
 *    Quem o escolhesse escolhia com que ticket o seu relato se funde — e, por
 *    aí, podia encostar o seu relato a um ticket já fechado para o fazer
 *    desaparecer, ou separar ocorrências do mesmo erro para baixar a gravidade.
 * 2. **O contexto técnico é um conjunto fechado de campos.** Não há
 *    `Record<string, unknown>` nem passagem de `jsonb` arbitrário: cada campo
 *    tem nome, tipo e limite. É isto que impede que, um dia, alguém meta o
 *    conteúdo de uma conversa dentro de `breadcrumbs` — que é precisamente o
 *    que 04 §2.7 #2 proíbe ("nunca conteúdo de mensagens ou documentos").
 * 3. **Tudo tem limite de tamanho.** Os breadcrumbs chegam do browser e o
 *    browser é território do utilizador: sem limite, um relato podia carregar
 *    megabytes para a base de dados.
 */

type AnySupabaseClient = SupabaseClient<Database>;

export const TICKET_STATUSES = [
  "new",
  "triage",
  "in_progress",
  "awaiting_confirmation",
  "closed",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TICKET_SEVERITIES = ["critical", "high", "medium", "low"] as const;
export type TicketSeverity = (typeof TICKET_SEVERITIES)[number];

export type TicketOrigin = "auto" | "report" | "both";

/**
 * As tabs do Suporte (04 §2.6) e a timeline de quem reportou (07 §5.11) são
 * duas leituras do mesmo `status`. Ficam as duas aqui para não haver uma
 * terceira versão do mapeamento num componente.
 */
export const TICKET_TABS = {
  pending: ["new", "triage"],
  inProgress: ["in_progress"],
  awaitingConfirmation: ["awaiting_confirmation"],
  closed: ["closed"],
} as const satisfies Record<string, readonly TicketStatus[]>;

export type TicketTab = keyof typeof TICKET_TABS;

/** O que o utilizador lê em "Os meus reports" (07 §5.11). */
export const REPORTER_TIMELINE: Record<TicketStatus, string> = {
  new: "received",
  triage: "analysing",
  in_progress: "fixing",
  awaiting_confirmation: "testing",
  closed: "resolved",
};

/**
 * O que o utilizador escreve. É tudo: 04 §2.7 #1 é explícito — "o utilizador
 * só escreve a descrição e anexa captura (opcional)". Nem título: o título sai
 * da primeira linha da descrição, porque pedir duas coisas a quem está a
 * reportar um problema é pedir uma a mais.
 */
export const reportProblemSchema = z.object({
  description: z
    .string()
    .trim()
    .min(10, "Descreva o problema com um pouco mais de detalhe.")
    .max(5000, "Máximo 5000 caracteres."),
  screenshotPath: z.string().trim().max(400).optional(),
});

export type ReportProblemInput = z.infer<typeof reportProblemSchema>;

/**
 * O contexto que o cliente junta automaticamente (04 §2.7 #2). Validado com o
 * mesmo rigor do que é escrito à mão: vem de `window`, e `window` é do
 * utilizador.
 */
export const technicalContextSchema = z.object({
  route: z.string().trim().max(300).optional(),
  buildSha: z.string().trim().max(60).optional(),
  browser: z.string().trim().max(200).optional(),
  os: z.string().trim().max(120).optional(),
  viewport: z.string().trim().max(40).optional(),
  network: z.string().trim().max(60).optional(),
  sessionId: z.string().trim().max(120).optional(),
  breadcrumbs: z
    .array(
      z.object({
        at: z.string().max(40),
        kind: z.enum(["navigation", "click", "error"]),
        // 200 caracteres dá para uma rota ou um rótulo de botão e não dá para
        // uma mensagem. O limite é a salvaguarda de 04 §2.7 #2 — não se confia
        // em que o coletor se porte bem para sempre.
        label: z.string().max(200),
      }),
    )
    .max(20)
    .optional(),
  consoleErrors: z.array(z.string().max(500)).max(20).optional(),
});

export type TechnicalContext = z.infer<typeof technicalContextSchema>;

export type ReportProblemResult = {
  id: string;
  ref: string;
  severity: TicketSeverity;
  /** `true` quando o relato se juntou a um ticket que já existia. */
  merged: boolean;
};

/**
 * O título que o Suporte lê na lista, derivado da descrição: a primeira frase,
 * cortada aos 120 caracteres. Uma lista de tickets todos chamados "Problema
 * reportado" é uma lista que não se pode varrer com os olhos.
 */
function titleFrom(description: string): string {
  const firstLine = description.split(/\r?\n/)[0]?.trim() ?? "";
  const sentence = firstLine.split(/(?<=[.!?])\s/)[0]?.trim() ?? firstLine;
  const candidate = sentence.length >= 3 ? sentence : description.trim();
  return candidate.length > 120 ? `${candidate.slice(0, 117)}…` : candidate || "Problema reportado";
}

/**
 * O `fingerprint` de um relato manual.
 *
 * **Não é o texto da descrição.** Duas pessoas a descrever o mesmo problema
 * escrevem frases diferentes, e agrupar por texto dava um ticket por pessoa —
 * que é o oposto do que 04 §2.7 #3 pede. O que as une é **onde** estavam: a
 * rota, mais o primeiro erro de consola quando existir. Com erro de consola, o
 * relato manual funde-se com o ticket automático do mesmo erro, que é o caso
 * que faz nascer o `origin = 'both'`.
 *
 * O prefixo `report:` existe para que um relato sem erro de consola nunca
 * colida com um ticket automático da mesma rota: são problemas diferentes —
 * um é "isto rebentou", o outro é "isto não faz o que eu esperava".
 */
export function manualFingerprint(context: TechnicalContext): string {
  const route = context.route?.replace(/[?#].*$/, "") || "unknown";
  const firstError = context.consoleErrors?.[0]?.slice(0, 200);
  return firstError ? `auto:${route}|${firstError}` : `report:${route}`;
}

/**
 * Submete um relato. Chamada **só** por Server Actions — recebe o cliente da
 * sessão, para que `auth.uid()` dentro de `report_problem` seja quem reportou.
 */
export async function reportProblem(
  client: AnySupabaseClient,
  input: ReportProblemInput,
  context: TechnicalContext,
): Promise<ReportProblemResult | { error: string }> {
  const { data, error } = await client.rpc("report_problem", {
    p_fingerprint: manualFingerprint(context),
    p_title: titleFrom(input.description),
    p_description: input.description,
    p_origin: "report",
    p_route: context.route,
    p_build_sha: context.buildSha,
    p_browser: context.browser,
    p_os: context.os,
    p_viewport: context.viewport,
    p_network: context.network,
    p_session_id: context.sessionId,
    p_breadcrumbs: context.breadcrumbs ?? null,
    p_console_errors: context.consoleErrors ?? null,
    p_screenshot_path: input.screenshotPath,
  });

  if (error) {
    // O `hint` traz a razão, não o texto — o mesmo contrato dos limites de
    // plano e do cancelamento.
    if (error.hint === "not_authenticated") return { error: "Sessão inválida." };
    if (error.hint === "title_required") return { error: "Descreva o problema." };
    return { error: "Não foi possível enviar o relato. Tente novamente." };
  }

  const row = data?.[0];
  if (!row) return { error: "Não foi possível enviar o relato. Tente novamente." };

  return {
    id: row.id,
    ref: row.ref,
    severity: row.severity,
    merged: row.merged,
  };
}

const SCREENSHOT_BUCKET = "ticket-screenshots";
const SCREENSHOT_MAX_BYTES = 5 * 1024 * 1024;
const SCREENSHOT_TYPES = ["image/png", "image/jpeg", "image/webp"];

/**
 * O corpo da Server Action, partilhado pelas duas apps.
 *
 * Vive aqui e não em cada `actions/support.ts` porque as duas apps fariam
 * exactamente o mesmo — e um relato validado de uma maneira na app e de outra
 * no interno é um relato validado de nenhuma. O que fica em cada app é só o
 * `cookies()` → cliente, que é a parte que é mesmo da app.
 *
 * A captura segue para o Storage **antes** do ticket, e uma falha no upload
 * **não** impede o relato: perder a imagem é mau, perder o relato por causa da
 * imagem é pior. O caminho fica `null` e o Suporte vê o relato sem anexo.
 */
export async function submitReport(
  client: AnySupabaseClient,
  formData: FormData,
): Promise<ReportProblemResult | { error: string }> {
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: "Sessão inválida." };

  const parsed = reportProblemSchema.safeParse({
    description: formData.get("description"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Descreva o problema." };
  }

  // O contexto chega como JSON e é tratado como qualquer outro input do
  // cliente: se não passar o schema, segue-se **sem** contexto em vez de
  // recusar o relato. O relato é do utilizador; o diagnóstico é nosso.
  let context: TechnicalContext = {};
  const raw = formData.get("snapshot");
  if (typeof raw === "string" && raw.length > 0 && raw.length < 64_000) {
    try {
      const candidate = technicalContextSchema.safeParse(JSON.parse(raw));
      if (candidate.success) context = candidate.data;
    } catch {
      context = {};
    }
  }

  let screenshotPath: string | undefined;
  const file = formData.get("screenshot");
  if (
    file &&
    typeof file === "object" &&
    "size" in file &&
    file.size > 0 &&
    file.size <= SCREENSHOT_MAX_BYTES &&
    SCREENSHOT_TYPES.includes(file.type)
  ) {
    const extension =
      file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    // `{profile_id}/…` é o que a policy do bucket lê (o primeiro segmento do
    // path é o dono). O sufixo aleatório evita que dois relatos seguidos da
    // mesma pessoa se sobreponham.
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
    const { error: uploadError } = await client.storage
      .from(SCREENSHOT_BUCKET)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (!uploadError) screenshotPath = path;
  }

  return reportProblem(client, { ...parsed.data, screenshotPath }, context);
}

/** A mudança de estado do Suporte. Só `support` — a função recusa o resto. */
export const ticketStatusSchema = z.object({
  ticketId: z.string().uuid(),
  status: z.enum(TICKET_STATUSES),
  fixNote: z.string().trim().max(2000).optional(),
});

export async function setTicketStatus(
  client: AnySupabaseClient,
  input: z.infer<typeof ticketStatusSchema>,
): Promise<{ ok: true } | { error: string }> {
  const { error } = await client.rpc("set_ticket_status", {
    p_ticket_id: input.ticketId,
    p_status: input.status,
    p_fix_note: input.fixNote,
  });

  if (error) {
    if (error.hint === "not_support") return { error: "Sem permissão para alterar o ticket." };
    if (error.hint === "ticket_not_found") return { error: "O ticket já não existe." };
    if (error.hint === "fix_note_required") {
      return { error: "Escreva o que foi corrigido antes de fechar o ticket." };
    }
    return { error: "Não foi possível guardar. Tente novamente." };
  }
  return { ok: true };
}

/**
 * O KPI "bugs abertos" do Painel do Admin — fecha D48. Devolve `null`, e não
 * zero, quando a leitura falha: um zero seria indistinguível de "nenhum bug
 * aberto", que é exactamente o motivo pelo qual 07 §21.2 mandou omitir o KPI
 * até a tabela existir.
 */
export async function openBugsCount(client: AnySupabaseClient): Promise<number | null> {
  const { data, error } = await client.rpc("open_bugs_count");
  if (error || typeof data !== "number") return null;
  return data;
}

// ---------------------------------------------------------------------------
// Leituras (P10-02)
// ---------------------------------------------------------------------------

export type SupportTicketRow =
  Database["public"]["Functions"]["support_list_tickets"]["Returns"][number];
export type SupportTicketDetail =
  Database["public"]["Functions"]["support_ticket_detail"]["Returns"][number];
export type TicketHistoryRow = Database["public"]["Functions"]["ticket_history"]["Returns"][number];
export type MyReportRow = Database["public"]["Functions"]["my_reports"]["Returns"][number];

export type TicketCounts = Record<TicketTab, number>;

const EMPTY_COUNTS: TicketCounts = {
  pending: 0,
  inProgress: 0,
  awaitingConfirmation: 0,
  closed: 0,
};

export async function listTickets(
  client: AnySupabaseClient,
  options: { tab?: TicketTab; search?: string; limit?: number } = {},
): Promise<SupportTicketRow[]> {
  const { data } = await client.rpc("support_list_tickets", {
    p_tab: options.tab ?? "pending",
    p_search: options.search || undefined,
    p_limit: options.limit ?? 50,
  });
  return data ?? [];
}

/**
 * Os contadores das tabs. Falha devolve zeros e não `null`: o ecrã mostra-se
 * na mesma, e um badge vazio é melhor do que um ecrã que não abre.
 */
export async function ticketCounts(client: AnySupabaseClient): Promise<TicketCounts> {
  const { data, error } = await client.rpc("support_ticket_counts");
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return EMPTY_COUNTS;
  const raw = data as Record<string, unknown>;
  const read = (key: TicketTab) => (typeof raw[key] === "number" ? (raw[key] as number) : 0);
  return {
    pending: read("pending"),
    inProgress: read("inProgress"),
    awaitingConfirmation: read("awaitingConfirmation"),
    closed: read("closed"),
  };
}

export async function ticketDetail(
  client: AnySupabaseClient,
  ticketId: string,
): Promise<SupportTicketDetail | null> {
  const { data } = await client.rpc("support_ticket_detail", { p_ticket_id: ticketId });
  return data?.[0] ?? null;
}

export async function ticketHistory(
  client: AnySupabaseClient,
  ticketId: string,
): Promise<TicketHistoryRow[]> {
  const { data } = await client.rpc("ticket_history", { p_ticket_id: ticketId });
  return data ?? [];
}

export async function myReports(client: AnySupabaseClient): Promise<MyReportRow[]> {
  const { data } = await client.rpc("my_reports");
  return data ?? [];
}

/**
 * "Copiar p/ agente" (04 §2.6) — o ticket em Markdown, pronto a colar num
 * agente de código.
 *
 * O formato não é decorativo: é o que 06 §Tempo Labs prevê como ponte entre o
 * suporte e a Software Factory — "ligue os tickets do suporte (Copiar p/
 * agente / export) como fonte de issues". Por isso termina num **pedido
 * explícito de correção** e não num despejo de dados: um agente que recebe
 * factos sem instrução responde com um resumo dos factos.
 *
 * O que **não** vai: o nome de quem reportou e o `session_id`. O agente que
 * recebe isto pode ser de terceiros, e nada aqui precisa de identificar a
 * pessoa para o bug ser corrigido.
 */
export function ticketToMarkdown(
  ticket: SupportTicketDetail,
  history: TicketHistoryRow[] = [],
): string {
  const lines: string[] = [
    `# Bug ${ticket.ref} — ${ticket.title}`,
    "",
    `**Gravidade:** ${ticket.severity} · **Estado:** ${ticket.status} · **Origem:** ${ticket.origin}`,
    `**Ocorrências:** ${ticket.occurrences} · **Pessoas afetadas:** ${ticket.affected_users}`,
    `**Primeira vez:** ${ticket.first_seen_at} · **Última:** ${ticket.last_seen_at}`,
    "",
    "## Relato",
    "",
    ticket.description || "_(sem descrição)_",
    "",
    "## Contexto técnico",
    "",
  ];

  const facts: [string, string | null][] = [
    ["Rota", ticket.route],
    ["Build", ticket.build_sha],
    ["Navegador", ticket.browser],
    ["Sistema", ticket.os],
    ["Viewport", ticket.viewport],
    ["Rede", ticket.network],
  ];
  for (const [label, value] of facts) {
    if (value) lines.push(`- **${label}:** ${value}`);
  }

  if (ticket.technical_purged_at) {
    lines.push(
      "",
      `_As últimas ações e os erros de consola foram apagados em ${ticket.technical_purged_at} ` +
        "pela retenção de 90 dias — não foram perdidos por falha de captura._",
    );
  }

  const errors = Array.isArray(ticket.console_errors) ? ticket.console_errors : [];
  if (errors.length > 0) {
    lines.push("", "## Erros de consola", "", "```", ...errors.map(String), "```");
  }

  const trail = Array.isArray(ticket.breadcrumbs) ? ticket.breadcrumbs : [];
  if (trail.length > 0) {
    lines.push("", "## Últimas ações", "");
    for (const step of trail) {
      const entry = step as { at?: string; kind?: string; label?: string };
      lines.push(`- \`${entry.at ?? "?"}\` ${entry.kind ?? "?"} — ${entry.label ?? "?"}`);
    }
  }

  if (history.length > 0) {
    lines.push("", "## Histórico", "");
    for (const event of history) {
      const from = event.status_from ? `${event.status_from} → ` : "";
      lines.push(
        `- \`${event.occurred_at}\` ${from}${event.status_to}${event.note ? ` — ${event.note}` : ""}`,
      );
    }
  }

  lines.push(
    "",
    "## Pedido",
    "",
    "Corrige este problema no repositório. Antes de alterar código: reproduz o",
    "erro pela rota e pelas últimas ações acima, e confirma a causa — não",
    "assumas a partir da descrição, que é o que o utilizador viu e não",
    "necessariamente o que aconteceu. No fim, escreve numa frase o que foi",
    "corrigido, em linguagem para quem reportou: esse texto vai para o campo",
    '"O que foi corrigido" do ticket e é o que a pessoa lê.',
  );

  return lines.join("\n");
}
