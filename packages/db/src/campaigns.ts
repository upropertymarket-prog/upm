import sanitizeHtml from "sanitize-html";
import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";
import { campaignBlocksSchema, type CampaignBlock } from "./campaign-blocks";
import type { Database } from "./database.types";
import {
  EMAIL_EVENT_TYPES,
  type CampaignEmailRow,
  type CampaignRow,
  type EmailEventType,
  type MailDatabase,
  type ScheduledSendRow,
} from "./pending-types";

/**
 * Campanhas — leitura, escrita e sanitização (P10-08 · 04 §2.6 · 05 §1.9)
 * =========================================================================
 * O módulo de dados das campanhas, irmão de `updates.ts` e de `signatures.ts`.
 * O **contrato** dos blocos vive noutro ficheiro (`campaign-blocks.ts`,
 * `@upm/db/campaign-blocks`) e é importado pelo construtor no browser; este
 * importa `sanitize-html` e é só de servidor. A separação não é estética: pôr
 * os dois no mesmo módulo levava o sanitizador para o bundle do cliente.
 *
 * ## O que a UI nunca recebe
 *
 * Nenhuma função aqui devolve endereços de e-mail (07 §24.6 #5).
 * `campaignAudienceCount()` devolve um número, `campaignSenderOptions()`
 * devolve o id, o endereço e o nome **das caixas da equipa** — que são a
 * identidade do remetente e não uma audiência. Os destinatários materializam-se
 * em `campaign_recipients` no envio, e esse caminho é o do `mail-worker`.
 *
 * ## Os blocos são sanitizados na escrita, como as novidades
 *
 * Mesma biblioteca e mesma razão (02 §4.3): o bloco `text` guarda HTML de um
 * editor rico, e esse HTML é desenhado em dois sítios — no `dangerouslySetInnerHTML`
 * do renderizador de e-mail e na pré-visualização **dentro do painel interno**.
 * A função `security definer` repete a verificação do seu lado
 * (`campaign_blocks_are_safe`), não como defesa mas como prova de que esta
 * correu.
 *
 * ## O chip da variável tem de sobreviver ao sanitizador
 *
 * `<span data-variable="nome" data-label="Nome" class="upm-chip">` é o contrato
 * entre o editor e `substituteCampaignVariables()`. Um sanitizador com a lista
 * de atributos por omissão deixava o `<span>` e levava o `data-variable` — e a
 * substituição deixava de encontrar nada, silenciosamente, num e-mail que sai
 * para milhares de pessoas com "Olá Nome," em vez do nome. Está nos testes.
 */

type AnySupabaseClient = SupabaseClient<Database>;

/** A mesma costura de `mail.ts`, `signatures.ts` e `updates.ts`; sai com o `db:types` (D64). */
function campaignClient(client: AnySupabaseClient): SupabaseClient<MailDatabase> {
  return client as unknown as SupabaseClient<MailDatabase>;
}

export type { CampaignEmailRow, CampaignRow, EmailEventType, ScheduledSendRow };
export { EMAIL_EVENT_TYPES };

export const CAMPAIGN_AUDIENCES = [
  "all",
  "owners",
  "buyers",
  "site_leads_pre",
  "site_leads_post",
] as const;
export type CampaignAudience = (typeof CAMPAIGN_AUDIENCES)[number];

export const CAMPAIGN_STATUSES = ["draft", "scheduled", "sending", "sent"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

/** Os tons de 04 §5.6, da mesma família de ciclo de vida das Atualizações. */
export const CAMPAIGN_STATUS_TONES: Record<CampaignStatus, string> = {
  draft: "draft",
  scheduled: "pending",
  sending: "pending",
  sent: "active",
};

/** O fundo por omissão, igual ao `default` da coluna (`20261015090000`). */
export const CAMPAIGN_DEFAULT_BG = "#f6f7f9";

// ---------------------------------------------------------------------------
// Sanitização dos blocos
// ---------------------------------------------------------------------------

const POLICY: sanitizeHtml.IOptions = {
  allowedTags: [
    "a",
    "b",
    "blockquote",
    "br",
    "em",
    "h2",
    "h3",
    "i",
    "li",
    "ol",
    "p",
    "span",
    "strong",
    "u",
    "ul",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    // O chip da variável — ver a nota de topo. `class` entra porque é o que o
    // desenha no editor; num cliente de e-mail não há folha e não faz nada.
    span: ["data-variable", "data-label", "class"],
    // O alinhamento do TipTap sai em `style="text-align:…"`, e é o que 04 §2.6
    // pede dentro do texto. A lista de propriedades permitidas fecha-o a isso.
    "*": ["style"],
  },
  allowedStyles: {
    "*": { "text-align": [/^left$|^center$|^right$/] },
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href"],
  allowProtocolRelative: false,
  // Sem isto o **conteúdo** de um `<script>` ficava como texto visível.
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe"],
  transformTags: {
    // Uma ligação num e-mail abre sempre fora. `target` não faz nada na maioria
    // dos clientes de correio, mas a mesma marcação é pré-visualizada no painel
    // interno, e aí faz.
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" },
    }),
  },
};

export function sanitizeCampaignHtml(html: string): string {
  return sanitizeHtml(html, POLICY);
}

/**
 * Sanitiza **o que é HTML** em cada bloco e deixa o resto como está.
 *
 * Só o bloco `text` guarda marcação. O `heading`, o `button` e o `footer`
 * guardam texto simples, e esse escapa-se no renderizador — passá-lo pelo
 * sanitizador transformava um `&` escrito à mão em `&amp;` visível.
 */
export function sanitizeCampaignBlocks(blocks: CampaignBlock[]): CampaignBlock[] {
  return blocks.map((block) =>
    block.type === "text" ? { ...block, html: sanitizeCampaignHtml(block.html) } : block,
  );
}

/** O que a sanitização retirou, para o ecrã o poder dizer (como nas novidades). */
export function campaignBlockFindings(blocks: CampaignBlock[]): string[] {
  const removed: string[] = [];

  for (const block of blocks) {
    if (block.type !== "text") continue;
    const clean = sanitizeCampaignHtml(block.html);
    const names = (value: string) =>
      new Set([...value.matchAll(/<\s*([a-zA-Z][a-zA-Z0-9]*)/g)].map((m) => m[1]!.toLowerCase()));

    const kept = names(clean);
    for (const tag of names(block.html)) if (!kept.has(tag)) removed.push(`<${tag}>`);
    for (const match of block.html.matchAll(/\s(on[a-z]+)\s*=/gi))
      removed.push(`${match[1]!.toLowerCase()}=`);
    if (/javascript\s*:/i.test(block.html)) removed.push("javascript:");
  }

  return [...new Set(removed)];
}

/**
 * O `jsonb` da coluna → blocos válidos.
 *
 * Devolve `[]` quando o que está guardado não passa o contrato, e isso é
 * deliberado: um bloco com um campo a menos escrito por uma versão anterior não
 * pode fazer o construtor rebentar na abertura. O ecrã mostra uma campanha
 * vazia, que é visível, em vez de um erro de render.
 */
export function parseCampaignBlocks(value: unknown): CampaignBlock[] {
  const parsed = campaignBlocksSchema.safeParse(value);
  if (parsed.success) return parsed.data;

  // Sem rodapé ainda não é inválido — é um e-mail em branco acabado de criar.
  const loose = z.array(z.unknown()).safeParse(value);
  if (loose.success && loose.data.length === 0) return [];
  return [];
}

/**
 * O `interval` do Postgres como dias.
 *
 * O `supabase-js` devolve `'3 days'`, `'00:00:00'` ou `'3 days 02:00:00'`. O
 * que o ecrã oferece são dias (o exemplo do doc 05 é `+3 days`), e a ida é
 * `p_delay_days`, inteiro — ver a nota de `campaign_email_save`. As horas de um
 * `interval` escrito à mão na base de dados perdem-se nesta leitura, e é o
 * preço de não ter um campo que ninguém pediu.
 */
export function delayInDays(interval: string | null | undefined): number {
  const match = /(-?\d+)\s*days?/i.exec(interval ?? "");
  return match ? Number(match[1]) : 0;
}

// ---------------------------------------------------------------------------
// Os esquemas das escritas
// ---------------------------------------------------------------------------

export const campaignSaveSchema = z.object({
  id: z.string().uuid().nullish(),
  name: z.string().trim().min(1, "A campanha precisa de um nome.").max(160),
  audience: z.enum(CAMPAIGN_AUDIENCES).default("all"),
  fromMailboxId: z.string().uuid().nullish(),
  /** Hexadecimal: um cliente de e-mail não tem os tokens (04 §5.1, 3.ª exceção). */
  emailBg: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "O fundo tem de ser hexadecimal.")
    .default(CAMPAIGN_DEFAULT_BG),
});

export type CampaignSaveInput = z.infer<typeof campaignSaveSchema>;

export const campaignEmailSaveSchema = z.object({
  id: z.string().uuid().nullish(),
  campaignId: z.string().uuid(),
  name: z.string().trim().max(160).default(""),
  subject: z.string().trim().max(300).default(""),
  preheader: z.string().trim().max(300).default(""),
  /**
   * Os blocos passam pelo contrato **antes** de serem gravados, e um e-mail
   * vazio é aceite: é o estado de um que acabou de ser criado. A partir de um
   * bloco, o `campaignBlocksSchema` exige o rodapé (02 §4.3) — e a função
   * `security definer` exige-o outra vez.
   */
  blocks: z.union([z.tuple([]), campaignBlocksSchema]),
  delayDays: z.number().int().min(0).max(365).default(0),
});

export type CampaignEmailSaveInput = z.infer<typeof campaignEmailSaveSchema>;

export const campaignScheduleSchema = z.object({
  id: z.string().uuid(),
  at: z.string().datetime({ offset: true }),
});

// ---------------------------------------------------------------------------
// Leitura
// ---------------------------------------------------------------------------

export async function listCampaigns(client: AnySupabaseClient): Promise<CampaignRow[]> {
  const { data } = await campaignClient(client)
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });

  return data ?? [];
}

/** Os e-mails de uma campanha, pela ordem da sequência. */
export async function listCampaignEmails(
  client: AnySupabaseClient,
  campaignId: string,
): Promise<CampaignEmailRow[]> {
  const { data } = await campaignClient(client)
    .from("campaign_emails")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("position", { ascending: true });

  return data ?? [];
}

/**
 * A contagem de uma audiência — e **só** a contagem (07 §24.6 #5).
 *
 * Devolve `null` em erro e não `0`: zero é uma resposta verdadeira e
 * frequente (o consentimento é opt-in e o registo ainda não o recolhe — D69), e
 * confundir "não consegui perguntar" com "não há ninguém" era dar a entender ao
 * Marketing que a audiência está vazia quando a leitura é que falhou.
 */
export async function campaignAudienceCount(
  client: AnySupabaseClient,
  audience: CampaignAudience,
): Promise<number | null> {
  const { data, error } = await campaignClient(client).rpc("campaign_audience_count", {
    p_audience: audience,
  });

  if (error || typeof data !== "number") return null;
  return data;
}

export type CampaignSender = { id: string; address: string; displayName: string };

/** As caixas activas como identidade de remetente (07 §24.6 #2). */
export async function campaignSenderOptions(client: AnySupabaseClient): Promise<CampaignSender[]> {
  const { data, error } = await campaignClient(client).rpc("campaign_sender_options");
  if (error || !Array.isArray(data)) return [];

  return data.map((row) => ({
    id: row.id,
    address: row.address,
    displayName: row.display_name,
  }));
}

/** A assinatura resolvida de uma caixa, para o bloco `signature` e a pré-visualização. */
export async function campaignSignatureHtml(
  client: AnySupabaseClient,
  mailboxId: string,
): Promise<string> {
  const { data, error } = await campaignClient(client).rpc("mailbox_signature", {
    p_mailbox_id: mailboxId,
  });

  if (error || typeof data !== "string") return "";
  return data;
}

// ---------------------------------------------------------------------------
// Escrita — uma função por porta, com o nome do RPC que chama
// ---------------------------------------------------------------------------

export async function saveCampaign(
  client: AnySupabaseClient,
  input: CampaignSaveInput,
): Promise<string> {
  const { data, error } = await campaignClient(client).rpc("campaign_save", {
    p_id: input.id ?? null,
    p_name: input.name,
    p_audience: input.audience,
    p_from_mailbox_id: input.fromMailboxId ?? null,
    p_email_bg: input.emailBg,
  });

  if (error) throw new Error(error.message);
  return String(data);
}

export async function saveCampaignEmail(
  client: AnySupabaseClient,
  input: CampaignEmailSaveInput,
): Promise<string> {
  const { data, error } = await campaignClient(client).rpc("campaign_email_save", {
    p_id: input.id ?? null,
    p_campaign_id: input.campaignId,
    p_name: input.name,
    p_subject: input.subject,
    p_preheader: input.preheader,
    // Sanitizado aqui e não no construtor: é o último ponto por onde o
    // conteúdo passa antes da base de dados (02 §4.3).
    p_blocks: sanitizeCampaignBlocks(input.blocks as CampaignBlock[]),
    p_delay_days: input.delayDays,
  });

  if (error) throw new Error(error.message);
  return String(data);
}

export async function deleteCampaignEmail(client: AnySupabaseClient, id: string): Promise<void> {
  const { error } = await campaignClient(client).rpc("campaign_email_delete", { p_id: id });
  if (error) throw new Error(error.message);
}

export async function scheduleCampaign(
  client: AnySupabaseClient,
  id: string,
  at: string,
): Promise<void> {
  const { error } = await campaignClient(client).rpc("campaign_schedule", {
    p_id: id,
    p_at: at,
  });
  if (error) throw new Error(error.message);
}

export async function unscheduleCampaign(client: AnySupabaseClient, id: string): Promise<void> {
  const { error } = await campaignClient(client).rpc("campaign_unschedule", { p_id: id });
  if (error) throw new Error(error.message);
}

export async function deleteCampaign(client: AnySupabaseClient, id: string): Promise<void> {
  const { error } = await campaignClient(client).rpc("campaign_delete", { p_id: id });
  if (error) throw new Error(error.message);
}

/**
 * O envio (`campaign_send_now`) — e o que ele **não** faz.
 *
 * Põe a campanha em `sending` e materializa o primeiro e-mail da sequência,
 * devolvendo quantos destinatários ficaram na fila. Quem entrega é o
 * `mail-worker`: a app não fala com SMTP (02 §3.3), e a lista de endereços
 * nunca atravessa esta fronteira — materializa-se dentro do Postgres
 * (07 §24.6 #5).
 */
export async function sendCampaignNow(client: AnySupabaseClient, id: string): Promise<number> {
  const { data, error } = await campaignClient(client).rpc("campaign_send_now", { p_id: id });
  if (error) throw new Error(error.message);
  return typeof data === "number" ? data : 0;
}

/**
 * O agendamento mais recente desta campanha (P10-09).
 *
 * **Não** filtra por `scheduled`, e isso é o ponto: o estado que o ecrã mais
 * precisa de mostrar é o que a campanha, sozinha, não consegue dizer — um
 * disparo que **falhou** três vezes deixa a campanha em `scheduled` para
 * sempre, com uma data que já passou e nenhuma explicação. Devolver só o que
 * está à espera era esconder exactamente o caso que vale a pena ver.
 */
export async function latestScheduledSend(
  client: AnySupabaseClient,
  campaignId: string,
): Promise<ScheduledSendRow | null> {
  const { data } = await campaignClient(client)
    .from("scheduled_sends")
    .select("*")
    .eq("kind", "campaign_email")
    .eq("ref_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data ?? null;
}

/**
 * Os recibos de uma campanha, por tipo (P10-09).
 *
 * Duas contagens por tipo e não uma: `total` são os eventos, `pessoas` são
 * endereços distintos. A diferença é a que faz um relatório poder ser lido —
 * "300 aberturas de 100 pessoas" diz algo; "300 aberturas" sobre uma campanha
 * de 100 destinatários parece um erro.
 */
export async function campaignReceipts(
  client: AnySupabaseClient,
  campaignId: string,
): Promise<{ type: EmailEventType; total: number; people: number }[]> {
  const { data, error } = await campaignClient(client).rpc("campaign_receipts", {
    p_campaign_id: campaignId,
  });

  if (error || !Array.isArray(data)) return [];
  return data.map((row) => ({ type: row.type, total: row.total, people: row.pessoas }));
}

/**
 * O cancelamento de subscrição, por token (02 §4.3).
 *
 * Chamada do site público **sem sessão** — o token é a identidade. Devolve
 * `false` só quando o token não existe; um token já usado devolve `true`,
 * porque "já estava cancelado" não é um erro de quem clicou.
 */
export async function unsubscribeByToken(
  client: AnySupabaseClient,
  token: string,
): Promise<boolean> {
  const { data, error } = await campaignClient(client).rpc("campaign_unsubscribe", {
    p_token: token,
  });
  if (error) return false;
  return data === true;
}
