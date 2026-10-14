import { z } from "zod";

/**
 * Ambiente do mail-worker (P10-03 · 02 §3.2)
 * =========================================================================
 * **Este processo é o único do projeto que corre com a `service_role`.** 02
 * §3.3 limita-a a "Edge Functions, webhooks e mail-worker", e é por isso que
 * ele não vive dentro de nenhuma das três apps Next: uma chave que ignora toda
 * a RLS não pode partilhar processo com código que serve pedidos de browser.
 *
 * Validado à partida e não onde é usado. Um worker que arranca sem
 * `SUPABASE_SERVICE_ROLE_KEY` e só descobre isso à primeira sincronização passa
 * horas a parecer vivo sem fazer nada — e o sintoma aparece numa caixa de
 * e-mail que "deixou de receber", longe da causa.
 */

const schema = z.object({
  SUPABASE_URL: z.string().url("SUPABASE_URL tem de ser um URL."),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20, "SUPABASE_SERVICE_ROLE_KEY em falta."),

  /**
   * O token que o Admin apresenta para pedir um teste de ligação. Sem ele, o
   * endpoint ficaria aberto a quem alcançasse o worker — e `POST
   * /mailboxes/:id/test` faz o servidor abrir uma ligação IMAP com as nossas
   * credenciais, que é exatamente o tipo de coisa que não se deixa sem porta.
   */
  MAIL_WORKER_TOKEN: z.string().min(16, "MAIL_WORKER_TOKEN tem de ter pelo menos 16 caracteres."),

  PORT: z.coerce.number().int().positive().default(8080),

  /** Saída transacional (D27). Sem chave, a fila fica por drenar e diz-se. */
  RESEND_API_KEY: z.string().optional(),
  /**
   * O remetente das notificações. Enquanto o domínio não estiver verificado, o
   * Resend só entrega de `onboarding@resend.dev` e só para o e-mail da conta
   * (07 §24.2) — o valor por omissão é esse, de propósito: falha de forma
   * visível em vez de parecer configurado.
   */
  MAIL_FROM: z.string().default("UProperty Market <onboarding@resend.dev>"),
  APP_URL: z.string().url().default("http://localhost:3001"),

  /** Minutos entre sincronizações de todas as caixas ativas. */
  SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(5),
  /** Minutos entre drenagens da fila de notificações. */
  OUTBOX_INTERVAL_MINUTES: z.coerce.number().int().positive().default(1),
  /** Mensagens lidas por caixa em cada passagem. */
  SYNC_BATCH: z.coerce.number().int().positive().max(500).default(50),
  /** Entregas tiradas da fila em cada passagem. */
  OUTBOX_BATCH: z.coerce.number().int().positive().max(200).default(25),
  /**
   * Minutos entre purgas dos anexos expirados (D66). Seis horas: a reteção
   * mede-se em dias, e varrer de minuto a minuto um bucket onde, na maioria
   * das passagens, não há nada para apagar é trabalho por trabalho.
   */
  PURGE_INTERVAL_MINUTES: z.coerce.number().int().positive().default(360),
  /** Mensagens com anexos expirados tratadas em cada passagem. */
  PURGE_BATCH: z.coerce.number().int().positive().max(1000).default(200),
});

export type Env = z.infer<typeof schema>;

export function readEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  · ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Ambiente inválido para o mail-worker:\n${problems.join("\n")}`);
  }
  return parsed.data;
}
