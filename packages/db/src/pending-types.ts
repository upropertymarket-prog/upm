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
