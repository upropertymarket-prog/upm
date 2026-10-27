import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@upm/db/server";
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
import { getAdminShellData } from "../../../lib/admin-shell";
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
  toggleMailLabel,
} from "../../suporte/email/actions";
import { MailboxView } from "../../suporte/email/MailboxView";
import "../../suporte/email/mailbox.css";

/**
 * `/admin/email` — a segunda porta da caixa de e-mail (26 out 2026)
 * =========================================================================
 * O Admin não tinha onde enviar nem receber e-mail. Tinha
 * `/admin/caixas-email`, que é a **configuração** — servidor, porta,
 * credencial, ligar e desligar a leitura — e nada que mostre uma mensagem.
 * Pedido do cliente: o Admin precisa de uma caixa a sério.
 *
 * ## Uma porta, não uma cópia
 *
 * O ficheiro é curto de propósito, e é o mesmo desenho de `/marketing/seo`:
 * importa o `MailboxView`, o `Composer` (por dentro dele) e as server actions
 * de `/suporte/email` — os mesmos, não equivalentes. O que muda entre as duas
 * portas é só o que se vê em volta: o papel, o grupo da barra lateral e os
 * contadores. **Dois clientes de correio sobre a mesma tabela divergem à
 * primeira alteração**, e um deles ficaria sem a correção que o outro levou.
 *
 * Importar de `../../suporte/` atravessa as áreas, e é a leitura certa: o dono
 * do ecrã é um só. Mudá-lo para um sítio neutro tornava-o de ninguém.
 *
 * ## O que é diferente, e é só uma coisa
 *
 * **Não se passa o `onCreateTicket`.** Criar um ticket a partir de um e-mail é
 * a única ação desta caixa que sai do correio para a fila de outra pessoa, e
 * 07 §5.10 reserva o workflow de tickets ao Suporte — é a mesma razão por que
 * `/admin/tickets` é só de leitura. Sem a prop, o botão não se desenha, e a
 * função `create_ticket_from_mail` continua a recusar o Admin do lado da base
 * de dados, que é o que torna isto uma regra e não uma escolha de ecrã.
 *
 * ## O que foi preciso do lado de dentro
 *
 * Nada disto se vê a partir daqui, e por isso fica escrito: o ecrã sozinho não
 * chegava. A **leitura** do correio já era `is_staff()` desde 13 out — o Admin
 * sempre viu as mensagens. Cada **escrita** é que o recusava, por
 * `is_support()`, e com um comentário explícito a dizer que era de propósito.
 * `20261026120000_mail_admin_door.sql` alarga sete sítios a `is_staff()`
 * (marcadores, estrela/lida, arquivo, etiquetas, rascunhos e anexos na Cloud),
 * deixa `create_ticket_from_mail` como estava, e mantém o **marketing fora** do
 * correio por 07 §24.6 — é `is_staff()`, não `is_internal()`.
 *
 * O estado vive no URL e o `fill` do shell são os mesmos do Suporte, pelas
 * mesmas razões; ver a nota de `/suporte/email/page.tsx`.
 */

export const dynamic = "force-dynamic";

const folderSchema = z.enum(["inbox", "sent", "drafts", "archive"]);
const uuid = z.string().uuid();

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function uuidOrNull(value: string | undefined): string | null {
  return value && uuid.safeParse(value).success ? value : null;
}

export default async function AdminMailboxPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const supabase = createClient(await cookies());

  const [mailboxes, shell] = await Promise.all([
    listMailboxOptions(supabase),
    getAdminShellData(supabase),
  ]);

  const requested = uuidOrNull(first(params.caixa));
  const mailboxId = mailboxes.some((box) => box.id === requested)
    ? requested
    : (mailboxes[0]?.id ?? null);

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

  const templates = await listActiveTemplates(supabase);

  return (
    <InternalChrome
      role="admin"
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
