import type { Database } from "@upm/db";

/**
 * A ponte de tipos de P10-03 — e a data de validade dela
 * =========================================================================
 * `packages/db/src/database.types.ts` é gerado por `pnpm db:types` **a partir
 * da base de dados ligada**. A migração `20261013110000_mail_sync.sql` ainda
 * não foi aplicada, logo `mail_threads`, `mail_messages`, `mail_labels` e
 * `mailbox_credential()` ainda não existem nesses tipos.
 *
 * Este ficheiro declara-os à mão, **num sítio só e com o nome do que é**, em
 * vez de espalhar `as never` pelas chamadas. Foi a lição de D52, na Fase 9: os
 * casts dispersos sobreviveram à regeneração que os tornava desnecessários, e
 * ninguém os encontrou porque não tinham nome.
 *
 * **Como se apaga:** `supabase db push` e depois `pnpm db:types`. A partir daí
 * `Database` já tem tudo isto e o ficheiro inteiro sai, com um `MailDatabase`
 * substituído por `Database`. Enquanto existir, é dívida e está registado como
 * tal.
 */

type MailFolder = "inbox" | "sent" | "drafts" | "archive";

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

type Insertable<Row, Required extends keyof Row> = Partial<Row> & Pick<Row, Required>;

type MailTable<Row, Required extends keyof Row> = {
  Row: Row;
  Insert: Insertable<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

/**
 * `delivery_status` ganhou `sending` na mesma migração (ver a nota lá sobre o
 * porquê). Como o valor novo também só entra nos tipos gerados depois do
 * `db:types`, a tabela da fila entra aqui com o estado alargado — por
 * substituição e não por interseção, que estreitaria o tipo em vez de o abrir.
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
      mail_threads: MailTable<MailThreadRow, "mailbox_id" | "thread_key">;
      mail_messages: MailTable<MailMessageRow, "mailbox_id" | "message_id">;
    };
    Functions: Database["public"]["Functions"] & {
      mailbox_credential: { Args: { p_mailbox_id: string }; Returns: string | null };
    };
  };
};
