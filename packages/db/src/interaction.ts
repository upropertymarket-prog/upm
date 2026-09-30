import { z } from "zod";

/**
 * Interação (Fase 5) — 05 §6.3, 07 §5.6, 07 §18.2/§18.3.
 * =========================================================================
 * Os estados e limites também existem como `check`/enum na migração
 * `20260929120000_interaction.sql`; aqui validam-se antes de a Server Action
 * chegar ao Postgres, nunca em vez dele (o mesmo padrão de `properties.ts`).
 */

// ---------------------------------------------------------------------------
// Visitas — 07 §5.6
// ---------------------------------------------------------------------------

export const VISIT_STATUSES = [
  "pending",
  "accepted",
  "rescheduled",
  "cancelled",
  "completed",
  "archived",
] as const;
export const visitStatusSchema = z.enum(VISIT_STATUSES);
export type VisitStatus = (typeof VISIT_STATUSES)[number];

/** 07 §5.6 — máximo 3 no total, contador partilhado pelos dois lados. */
export const MAX_RESCHEDULES = 3;

/** Etiquetas de 04 §5.6 (cores de estado das visitas). */
export const VISIT_STATUS_LABELS: Record<VisitStatus, string> = {
  pending: "Pendente",
  accepted: "Aceite",
  rescheduled: "Reagendada",
  cancelled: "Cancelada",
  completed: "Realizada",
  archived: "Arquivada",
};

/**
 * Pedido de visita (03 F6 passo 1, modal "Pedir visita" de 04 §8.4).
 * A data chega do formulário como `YYYY-MM-DD` + `HH:MM`; junta-se aqui para
 * a validação do futuro ser feita uma vez só.
 */
export const visitRequestSchema = z
  .object({
    property_id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
    message: z.string().trim().max(1000),
  })
  .refine((value) => new Date(`${value.date}T${value.time}`) > new Date(), {
    message: "A visita tem de ser numa data futura",
    path: ["date"],
  });
export type VisitRequestInput = z.infer<typeof visitRequestSchema>;

export const rescheduleSchema = z
  .object({
    id: z.string().uuid(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida"),
    time: z.string().regex(/^\d{2}:\d{2}$/, "Hora inválida"),
  })
  .refine((value) => new Date(`${value.date}T${value.time}`) > new Date(), {
    message: "A nova data tem de ser no futuro",
    path: ["date"],
  });
export type RescheduleInput = z.infer<typeof rescheduleSchema>;

/** `YYYY-MM-DD` + `HH:MM` → ISO, para a função SQL receber um `timestamptz`. */
export function toProposedAt(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

// ---------------------------------------------------------------------------
// Mensagens — 05 §6.3
// ---------------------------------------------------------------------------

export const messageSchema = z.object({
  conversation_id: z.string().uuid(),
  body: z.string().trim().min(1, "Escreva uma mensagem").max(4000),
});
export type MessageInput = z.infer<typeof messageSchema>;

// ---------------------------------------------------------------------------
// Leads — 07 §18.2
// ---------------------------------------------------------------------------

export const LEAD_STAGES = ["new", "contacted", "visit", "closed"] as const;
export const leadStageSchema = z.enum(LEAD_STAGES);
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_OUTCOMES = ["won", "lost"] as const;
export const leadOutcomeSchema = z.enum(LEAD_OUTCOMES);
export type LeadOutcome = (typeof LEAD_OUTCOMES)[number];

/** Nomes do pipeline, tal como a referência de design os escreve. */
export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "Novo",
  contacted: "Contactado",
  visit: "Visita",
  closed: "Fechado",
};

export const LEAD_OUTCOME_LABELS: Record<LeadOutcome, string> = {
  won: "Concretizado",
  lost: "Não concretizado",
};

/** 07 §18.2 — `outcome` é obrigatório ao fechar e proibido fora de `closed`. */
export const leadStageUpdateSchema = z
  .object({
    id: z.string().uuid(),
    stage: leadStageSchema,
    outcome: leadOutcomeSchema.nullable(),
  })
  .refine((value) => (value.stage === "closed" ? value.outcome !== null : value.outcome === null), {
    message: "Indique se o negócio se concretizou",
    path: ["outcome"],
  });
export type LeadStageUpdateInput = z.infer<typeof leadStageUpdateSchema>;

// ---------------------------------------------------------------------------
// Notificações — 02 §10, 05 §6.9
// ---------------------------------------------------------------------------

/** A lista de 02 §10, inteira. Esta fase emite os cinco primeiros. */
export const NOTIFICATION_TYPES = [
  "message",
  "visit_request",
  "visit_update",
  "price_drop",
  "search_alert",
  "document_shared",
  "ticket_update",
  "invoice",
] as const;
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** Os tipos que já têm emissor — os únicos que aparecem nas Definições. */
export const ACTIVE_NOTIFICATION_TYPES = [
  "message",
  "visit_request",
  "visit_update",
  "price_drop",
  "search_alert",
] as const satisfies readonly NotificationType[];

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  message: "Mensagens novas",
  visit_request: "Pedidos de visita",
  visit_update: "Alterações a visitas",
  price_drop: "Descidas de preço em imóveis guardados",
  search_alert: "Alertas de pesquisa",
  document_shared: "Documentos partilhados",
  ticket_update: "Atualizações dos meus reports",
  invoice: "Faturas",
};

/**
 * `profiles.notification_prefs` (05 §6.1). Ausente = ligado: as preferências
 * são opt-out, senão uma conta nova não receberia nada — a mesma regra que a
 * função `notify()` aplica no servidor.
 */
export const notificationChannelPrefsSchema = z.object({
  inapp: z.boolean(),
  email: z.boolean(),
});

export const notificationPrefsSchema = z.record(
  notificationTypeSchema,
  notificationChannelPrefsSchema,
);
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export function prefEnabled(
  prefs: NotificationPrefs | null | undefined,
  type: NotificationType,
  channel: "inapp" | "email",
): boolean {
  return prefs?.[type]?.[channel] ?? true;
}
