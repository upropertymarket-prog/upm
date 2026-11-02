import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { createClient } from "@upm/db/server";
import { recordStaffRead } from "@upm/db/audit";
import { listActiveTemplates } from "@upm/db/message-templates";
import {
  getMailMessage,
  listMail,
  listMailLabels,
  listMailboxOptions,
  mailFolderCounts,
  mailboxSignature,
} from "@upm/db/mail";

import { InternalChrome } from "../../../components/InternalChrome";
import { getSupportShellData } from "../../../lib/support-shell";
import { setLocalePreference } from "../../actions/preferences";
import {
  addLabel,
  attachmentLink,
  attachmentToCloud,
  discardDraft,
  moveMessage,
  saveDraft,
  sendMail,
  setFlags,
  syncNow,
  ticketFromMail,
  toggleMailLabel,
} from "./actions";
import { MailboxView } from "./MailboxView";
import "./mailbox.css";

/**
 * `/suporte/email` — a Caixa de e-mail (P10-04 · 04 §2.5)
 * =========================================================================
 * A segunda rota da área `/suporte`, e a primeira que mostra o que o
 * `mail-worker` escreve.
 *
 * **O estado vive no URL** (`?caixa=&pasta=&marcador=&q=&estrela=&id=`), como
 * nos tickets: uma mensagem é partilhável por link entre quem está de turno, e
 * um F5 não perde o sítio onde se estava.
 *
 * A caixa por omissão é a primeira da lista por endereço — e não "a última que
 * usaste", que exigiria guardar preferência por utilizador para um ecrã que
 * ainda não sabemos como vai ser usado. Quando houver uso, há dado para decidir.
 */

export const dynamic = "force-dynamic";

// As quatro pastas de `mail_folder`: `sent` e `drafts` ainda nascem vazias —
// quem lá escreve é o composer, em P10-05 —, mas aparecem no menu lateral
// porque existem no esquema e porque uma pasta que falta é mais confusa do que
// uma pasta vazia.
const folderSchema = z.enum(["inbox", "sent", "drafts", "archive"]);
const uuid = z.string().uuid();

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function uuidOrNull(value: string | undefined): string | null {
  return value && uuid.safeParse(value).success ? value : null;
}

export default async function SupportMailboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const supabase = createClient(await cookies());
  const t = await getTranslations();

  const [mailboxes, shell] = await Promise.all([
    listMailboxOptions(supabase),
    getSupportShellData(supabase, t("sidebar.groups.support")),
  ]);

  const requested = uuidOrNull(first(params.caixa));
  const mailboxId = mailboxes.some((box) => box.id === requested)
    ? requested
    : (mailboxes[0]?.id ?? null);

  // Abrir uma caixa é uma leitura de correio de clientes: fica registada antes
  // de se mostrar uma única mensagem (A8, 12 §9.2). Se o registo falhar, a
  // caixa não abre — a função atira e a página cai no `error.tsx`.
  if (mailboxId) {
    await recordStaffRead(supabase, {
      action: "mailbox.opened",
      entity: "mailboxes",
      entityId: mailboxId,
    });
  }

  const folderResult = folderSchema.safeParse(first(params.pasta) ?? "");
  const folder = folderResult.success ? folderResult.data : "inbox";
  const starred = first(params.estrela) === "1";
  const search = (first(params.q) ?? "").trim().slice(0, 120);
  const labelId = uuidOrNull(first(params.marcador));
  const selectedId = uuidOrNull(first(params.id));

  const [labels, messages, counts, selected, signature] = mailboxId
    ? await Promise.all([
        listMailLabels(supabase, mailboxId),
        listMail(supabase, {
          mailboxId,
          folder,
          labelId: labelId ?? undefined,
          search: search || undefined,
          starred,
        }),
        mailFolderCounts(supabase, mailboxId),
        selectedId ? getMailMessage(supabase, selectedId) : Promise.resolve(null),
        mailboxSignature(supabase, mailboxId),
      ])
    : [[], [], { inbox: 0, sent: 0, drafts: 0, archive: 0, unread: 0, starred: 0 }, null, ""];

  /**
   * Os modelos de e-mail do Marketing (21 out 2026).
   *
   * **Só os ativos**, e fora do `Promise.all` de cima porque não dependem da
   * caixa escolhida: são os mesmos em todas. Uma leitura a mais por abertura da
   * caixa, de uma tabela com dezenas de linhas — o que se ganha é o Suporte
   * deixar de redigir do zero a resposta que o Marketing já aprovou.
   */
  const templates = await listActiveTemplates(supabase);

  return (
    <InternalChrome
      role="support"
      userName={shell.userName}
      userMeta={shell.userMeta}
      activeId="mailbox"
      locale={shell.locale}
      onLocaleChange={setLocalePreference}
      counters={shell.counters}
      fill
    >
      <MailboxView
        mailboxes={mailboxes}
        mailboxId={mailboxId}
        folder={folder}
        labels={labels}
        labelId={labelId}
        search={search}
        starred={starred}
        messages={messages}
        selected={selected}
        counts={counts}
        locale={shell.locale}
        onFlags={setFlags}
        onMove={moveMessage}
        onCreateLabel={addLabel}
        onToggleLabel={toggleMailLabel}
        onCreateTicket={ticketFromMail}
        onSync={syncNow}
        templates={templates}
        signature={signature}
        onSaveDraft={saveDraft}
        onSend={sendMail}
        onDiscardDraft={discardDraft}
        onAttachmentLink={attachmentLink}
        onAttachmentToCloud={attachmentToCloud}
      />
    </InternalChrome>
  );
}
