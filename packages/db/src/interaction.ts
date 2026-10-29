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

/**
 * As etiquetas de 04 §5.6 estão em `visits.status.*` nas mensagens, não aqui:
 * este pacote fala com a base de dados e não sabe em que idioma o ecrã está
 * (mesma razão do `SHARE_PERMISSION_LABELS` e dos rótulos de contrato, que
 * saíram daqui a 19 out). O que fica é a lista de estados e os tons.
 */

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

/**
 * Anexos do chat (07 §19.6 · D28)
 * -------------------------------------------------------------------------
 * `messages.attachments` é `jsonb` e nasceu vazia na Fase 5. Esta é a forma
 * das suas entradas — uma só por mensagem, que é o que a UI envia: escolher
 * um ficheiro envia-o, em vez de o acumular num rascunho que se pode perder.
 *
 * `path` é o caminho no bucket `chat-attachments`, com a convenção que a
 * Fase 6 escreveu: `{conversation_id}/{message_id}/{nome}`. Não é URL: as
 * ligações são assinadas e curtas, pedidas uma a uma (08 §7.3).
 *
 * Os limites são os mesmos da Cloud (07 §19.8 #2 e §19.6): 25 MB, PDF/JPG/PNG
 * validados pela assinatura de conteúdo. Vêm de `@upm/db/cloud` — um limite
 * escrito duas vezes é um limite que vai divergir.
 */
export const messageAttachmentSchema = z.object({
  path: z.string().min(1),
  name: z.string().min(1).max(200),
  mime: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  size: z.number().int().positive(),
});
export type MessageAttachment = z.infer<typeof messageAttachmentSchema>;

/** Lê a coluna `jsonb` com desconfiança: o que não tem a forma certa cai. */
export function parseAttachments(value: unknown): MessageAttachment[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const parsed = messageAttachmentSchema.safeParse(entry);
    return parsed.success ? [parsed.data] : [];
  });
}

// ---------------------------------------------------------------------------
// Leads — 07 §18.2
// ---------------------------------------------------------------------------

export const LEAD_STAGES = ["new", "contacted", "visit", "closed"] as const;
export const leadStageSchema = z.enum(LEAD_STAGES);
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_OUTCOMES = ["won", "lost"] as const;
export const leadOutcomeSchema = z.enum(LEAD_OUTCOMES);
export type LeadOutcome = (typeof LEAD_OUTCOMES)[number];

/** Os nomes do pipeline estão em `leads.stage.*` e `leads.outcome.*`. */

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

/** Os nomes dos tipos de notificação estão em `notifications.type.*`. */

/**
 * `profiles.notification_prefs` (05 §6.1). Ausente = ligado: as preferências
 * são opt-out, senão uma conta nova não receberia nada — a mesma regra que a
 * função `notify()` aplica no servidor.
 */
export const notificationChannelPrefsSchema = z.object({
  inapp: z.boolean(),
  email: z.boolean(),
});

/**
 * `partialRecord` e não `record`: na v4 do `zod`, um `record` com chaves de um
 * `enum` passou a exigir **todas** as chaves presentes. Aqui isso estaria ao
 * contrário do que a coluna significa — a nota acima diz que ausente é
 * ligado, porque as preferências são opt-out — e uma conta nova, cujo
 * `notification_prefs` é `{}`, deixaria de validar.
 */
export const notificationPrefsSchema = z.partialRecord(
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
