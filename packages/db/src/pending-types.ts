import type { Database } from "./database.types";

/**
 * A ponte de tipos do correio — e a data de validade dela (D64)
 * =========================================================================
 * `database.types.ts` é gerado por `pnpm db:types`, que fala com a **API de
 * gestão** do Supabase e precisa de um `SUPABASE_ACCESS_TOKEN` válido. O que
 * está em `.secrets/` já não é aceite ("Invalid access token"), e gerar a
 * partir da base de dados (`--db-url`) exige Docker, que esta máquina não tem.
 *
 * As migrações **estão aplicadas** — `mail_threads`, `mail_messages`,
 * `mail_labels`, `mailbox_credential()`, as quatro funções de escrita do
 * correio e o valor `sending` de `delivery_status` existem no Postgres e
 * passam o `gate:db`. O que falta é o ficheiro gerado os conhecer.
 *
 * Até lá, declaram-se aqui — **num sítio só, com o nome do que é**, e não
 * espalhados em `as never` pelas chamadas. Foi a lição de D52, na Fase 9: os
 * casts dispersos sobreviveram à regeneração que os tornava desnecessários
 * porque ninguém sabia onde estavam.
 *
 * **Como se apaga:** um token de gestão novo, `pnpm db:types`, e este ficheiro
 * sai inteiro — `MailDatabase` passa a ser `Database` em `mail.ts` e no
 * `mail-worker`. Está registado como D64 no doc 10.
 */

export const MAIL_FOLDERS = ["inbox", "sent", "drafts", "archive"] as const;
export type MailFolder = (typeof MAIL_FOLDERS)[number];

/**
 * Os dois valores de enum que a área do Marketing abriu (P10-07)
 * =========================================================================
 * `user_role` ganhou `marketing` e `staff_department` também
 * (`20261014120000`), e o `database.types.ts` **ainda não os conhece** — é a
 * mesma D64 que mantém as tabelas do correio aqui.
 *
 * O que isto estragava era subtil e vale explicá-lo: um
 * `profile?.role === "marketing"` não dá erro de tipo "em falta", dá
 * **TS2367 — esta comparação não tem sobreposição**, porque o TypeScript sabe
 * que o enum gerado não tem esse valor. O compilador tinha razão: a comparação
 * era sempre falsa *para ele*. No Postgres é verdadeira.
 *
 * `asPendingRole` é a ponte, e está aqui com nome em vez de espalhada em
 * `as never` pelos quatro sítios que comparam papéis — a lição de D52.
 */
export type PendingUserRole = Database["public"]["Enums"]["user_role"] | "marketing";
export type PendingStaffDepartment = Database["public"]["Enums"]["staff_department"] | "marketing";

/** O papel como o Postgres o conhece hoje, não como o ficheiro gerado o conhece. */
export function asPendingRole(role: string | null | undefined): PendingUserRole | null {
  return (role ?? null) as PendingUserRole | null;
}

export function asPendingDepartment(
  department: string | null | undefined,
): PendingStaffDepartment | null {
  return (department ?? null) as PendingStaffDepartment | null;
}

export type MailThreadRow = {
  id: string;
  mailbox_id: string;
  thread_key: string;
  subject: string;
  last_message_at: string;
  message_count: number;
  created_at: string;
  updated_at: string;
};

export type MailMessageRow = {
  id: string;
  mailbox_id: string;
  thread_id: string | null;
  message_id: string;
  in_reply_to: string | null;
  from_address: string;
  from_name: string;
  to_addresses: string[];
  cc_addresses: string[];
  bcc_addresses: string[];
  subject: string;
  html: string | null;
  text_body: string | null;
  folder: MailFolder;
  is_read: boolean;
  is_starred: boolean;
  labels: string[];
  attachments: unknown;
  ticket_id: string | null;
  sent_at: string | null;
  received_at: string;
  created_at: string;
  updated_at: string;
};

/** `20261014090000`, com o composer; o editor é P10-06 (`20261014110000`). */
export type EmailSignatureRow = {
  id: string;
  name: string;
  html: string;
  mailbox_ids: string[];
  created_at: string;
  updated_at: string;
};

/** `20261014120200`, com a área do Marketing (P10-07). */
export type AppUpdateRow = {
  id: string;
  version: string;
  title: string;
  body_html: string;
  points: string[];
  image_path: string | null;
  image_alt: string;
  audience: "all" | "owners" | "buyers";
  status: "draft" | "scheduled" | "published" | "archived";
  delivery: "banner" | "next_login" | "mandatory";
  scheduled_for: string | null;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AppUpdateViewRow = {
  id: string;
  update_id: string;
  profile_id: string;
  seen_at: string;
};

/**
 * `20261015090000` (as tabelas) e `20261015120000` (as escritas), com as
 * campanhas (P10-08).
 *
 * `blocks` entra como `unknown` e não como `CampaignBlock[]`: o que está na
 * base de dados é `jsonb` — pode ter sido escrito por uma versão anterior do
 * contrato — e quem decide se é válido é `campaignBlocksSchema`, na leitura.
 * Tipá-lo aqui era prometer ao compilador uma garantia que a coluna não dá.
 *
 * `delay` é texto porque é o que o `supabase-js` devolve de um `interval`
 * (`'3 days'`). Quem o converte para dias é `campaigns.ts`, num sítio só — a
 * ida é `p_delay_days`, que é inteiro de propósito (ver a nota da função).
 */
export type CampaignRow = {
  id: string;
  name: string;
  audience: "all" | "owners" | "buyers" | "site_leads_pre" | "site_leads_post";
  from_mailbox_id: string | null;
  email_bg: string;
  status: "draft" | "scheduled" | "sending" | "sent";
  scheduled_at: string | null;
  sent_at: string | null;
  recipients: number;
  opens: number;
  clicks: number;
  bounces: number;
  unsubscribes: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignEmailRow = {
  id: string;
  campaign_id: string;
  position: number;
  name: string;
  subject: string;
  preheader: string;
  blocks: unknown;
  delay: string;
  send_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignRecipientRow = {
  id: string;
  campaign_id: string;
  campaign_email_id: string | null;
  email: string;
  profile_id: string | null;
  status: "pending" | "sent" | "delivered" | "bounced" | "failed";
  opened_at: string | null;
  clicked_at: string | null;
  unsubscribe_token: string;
  created_at: string;
};

export type EmailSuppressionRow = {
  id: string;
  email: string;
  reason: "unsubscribe" | "bounce" | "complaint";
  campaign_id: string | null;
  created_at: string;
};

export type MailLabelRow = {
  id: string;
  mailbox_id: string;
  name: string;
  color: string;
  created_at: string;
};

type Insertable<Row, Required extends keyof Row> = Partial<Row> & Pick<Row, Required>;

type PendingTable<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Insertable<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

/**
 * `delivery_status` ganhou `sending` na mesma leva (o worker reclama a entrega
 * antes de a enviar, para duas passagens não duplicarem o e-mail). Entra por
 * **substituição** da tabela e não por interseção, que estreitaria o tipo em
 * vez de o abrir.
 */
type Deliveries = Database["public"]["Tables"]["notification_deliveries"];
type DeliveryStatus = Database["public"]["Enums"]["delivery_status"] | "sending";

type PatchedDeliveries = {
  Row: Omit<Deliveries["Row"], "status"> & { status: DeliveryStatus };
  Insert: Omit<Deliveries["Insert"], "status"> & { status?: DeliveryStatus };
  Update: Omit<Deliveries["Update"], "status"> & { status?: DeliveryStatus };
  Relationships: Deliveries["Relationships"];
};

export type MailDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables" | "Functions"> & {
    Tables: Omit<Database["public"]["Tables"], "notification_deliveries"> & {
      notification_deliveries: PatchedDeliveries;
      mail_threads: PendingTable<MailThreadRow, "mailbox_id" | "thread_key">;
      mail_messages: PendingTable<MailMessageRow, "mailbox_id" | "message_id">;
      mail_labels: PendingTable<MailLabelRow, "mailbox_id" | "name">;
      email_signatures: PendingTable<EmailSignatureRow, "name">;
      app_updates: PendingTable<AppUpdateRow, "title">;
      app_update_views: PendingTable<AppUpdateViewRow, "update_id" | "profile_id">;
      campaigns: PendingTable<CampaignRow, "name">;
      campaign_emails: PendingTable<CampaignEmailRow, "campaign_id" | "position">;
      campaign_recipients: PendingTable<CampaignRecipientRow, "campaign_id" | "email">;
      email_suppressions: PendingTable<EmailSuppressionRow, "email" | "reason">;
    };
    Functions: Database["public"]["Functions"] & {
      mailbox_credential: { Args: { p_mailbox_id: string }; Returns: string | null };
      mail_set_flags: {
        Args: { p_message_id: string; p_is_read?: boolean; p_is_starred?: boolean };
        Returns: undefined;
      };
      mail_move: { Args: { p_message_id: string; p_folder: MailFolder }; Returns: undefined };
      mail_set_labels: { Args: { p_message_id: string; p_labels: string[] }; Returns: undefined };
      create_ticket_from_mail: {
        Args: { p_message_id: string };
        Returns: { id: string; ref: string; created: boolean }[];
      };
      mail_unread_count: { Args: never; Returns: number };
      mail_save_draft: {
        Args: {
          p_mailbox_id: string;
          p_draft_id?: string | null;
          p_to?: string[];
          p_cc?: string[];
          p_bcc?: string[];
          p_subject?: string;
          p_html?: string;
          p_text?: string;
          p_in_reply_to?: string | null;
        };
        Returns: string;
      };
      mail_discard_draft: { Args: { p_draft_id: string }; Returns: undefined };
      mailbox_signature: { Args: { p_mailbox_id: string }; Returns: string };
      /** As três portas do editor de assinaturas (P10-06). */
      resolve_signature_variables: {
        Args: { p_html: string; p_mailbox_id: string };
        Returns: string;
      };
      email_signature_save: {
        Args: { p_id: string | null; p_name: string; p_html: string; p_mailbox_ids: string[] };
        Returns: string;
      };
      email_signature_delete: { Args: { p_id: string }; Returns: undefined };
      /** Os helpers de papel novos (P10-07 · 07 §24.6). */
      is_marketing: { Args: never; Returns: boolean };
      is_internal: { Args: never; Returns: boolean };
      /** As Atualizações (P10-07). */
      app_updates_for_me: {
        Args: never;
        Returns: {
          id: string;
          version: string;
          title: string;
          body_html: string;
          points: string[];
          image_path: string | null;
          image_alt: string;
          delivery: "banner" | "next_login" | "mandatory";
          published_at: string | null;
        }[];
      };
      mark_app_update_seen: { Args: { p_update_id: string }; Returns: undefined };
      app_update_reach: { Args: never; Returns: { update_id: string; seen: number }[] };
      app_update_save: {
        Args: {
          p_id: string | null;
          p_version: string;
          p_title: string;
          p_body_html: string;
          p_points: string[];
          p_image_path: string | null;
          p_image_alt: string;
          p_audience: string;
          p_delivery: string;
          p_scheduled_for: string | null;
        };
        Returns: string;
      };
      app_update_publish: { Args: { p_id: string }; Returns: undefined };
      app_update_archive: { Args: { p_id: string }; Returns: undefined };
      app_update_delete: { Args: { p_id: string }; Returns: undefined };
      /**
       * As campanhas (P10-08). `campaign_audience_count` nasceu com as tabelas
       * em `20261015090000`; as sete restantes são as escritas de
       * `20261015120000`.
       *
       * `p_audience` e `p_blocks` entram como `string`/`unknown` e não como os
       * tipos gerados pela mesma razão de `p_source` nos anexos: os dois enums
       * (`campaign_audience`, `campaign_status`) nasceram nessas migrações e o
       * ficheiro gerado de hoje não os conhece. Quem os valida é o zod da
       * server action, antes de chegarem aqui.
       */
      campaign_audience_count: { Args: { p_audience: string }; Returns: number };
      campaign_sender_options: {
        Args: never;
        Returns: { id: string; address: string; display_name: string }[];
      };
      campaign_save: {
        Args: {
          p_id: string | null;
          p_name: string;
          p_audience: string;
          p_from_mailbox_id: string | null;
          p_email_bg: string;
        };
        Returns: string;
      };
      campaign_email_save: {
        Args: {
          p_id: string | null;
          p_campaign_id: string;
          p_name: string;
          p_subject: string;
          p_preheader: string;
          p_blocks: unknown;
          p_delay_days: number;
        };
        Returns: string;
      };
      campaign_email_delete: { Args: { p_id: string }; Returns: undefined };
      campaign_schedule: { Args: { p_id: string; p_at: string }; Returns: undefined };
      campaign_unschedule: { Args: { p_id: string }; Returns: undefined };
      campaign_delete: { Args: { p_id: string }; Returns: undefined };
      /**
       * Os três RPC dos anexos (D66). `p_source` entra como `string` e não
       * como o enum gerado porque o valor `mail_attachment` nasceu na mesma
       * migração: o ficheiro gerado de hoje não o conhece, e escrevê-lo aqui
       * como união à mão era inventar um segundo sítio onde o enum vive.
       */
      cloud_register_staff_file: {
        Args: {
          p_name: string;
          p_mime: string;
          p_size: number;
          p_storage_path: string;
          p_checksum: string;
          p_source?: string;
        };
        Returns: string;
      };
      mail_attachment_saved_to_cloud: {
        Args: { p_message_id: string; p_index: number; p_file_id: string };
        Returns: undefined;
      };
      mail_attachments_expired: {
        Args: { p_limit?: number };
        Returns: { message_id: string; paths: string[] }[];
      };
      mail_attachment_purged: { Args: { p_message_id: string }; Returns: undefined };
      mail_record_sent: {
        Args: {
          p_mailbox_id: string;
          p_message_id: string;
          p_to: string[];
          p_cc: string[];
          p_bcc: string[];
          p_subject: string;
          p_html: string;
          p_text: string;
          p_from_name?: string;
          p_draft_id?: string | null;
          p_in_reply_to?: string | null;
        };
        Returns: string;
      };
    };
  };
};
