import type {
  MailLabelRow,
  MailListItem,
  MailMessageRow,
  MailboxOption,
} from "../../../packages/db/src/mail";

/**
 * Correio — os dados das storyboards da Caixa de e-mail (P10-04)
 * =========================================================================
 * Ao lado de `tickets.ts`, e pela mesma razão: o ecrã aparece em mais do que
 * uma moldura (com mensagem aberta, sem mensagem, sem caixas) e duas cópias dos
 * dados divergiriam à primeira alteração.
 *
 * As escolhas:
 *
 * - **Uma mensagem por ler e uma lida**, porque a lista distingue as duas com o
 *   peso do texto — com todas iguais não se via se a distinção existe.
 * - **Uma com ticket criado**, que é a etiqueta que fecha o ciclo entre a caixa
 *   e `/suporte/tickets`.
 * - **HTML a sério na mensagem aberta**, com uma tabela e uma ligação externa:
 *   é assim que chegam os e-mails verdadeiros, e é o que prova que o `iframe`
 *   com `sandbox` os mostra sem os deixar tocar na página.
 * - **Datas fixas.** Duas montagens da mesma storyboard têm de dar o mesmo
 *   pixel.
 */

export const MAILBOXES: MailboxOption[] = [
  {
    id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
    address: "suporte@upropertymarket.pt",
    displayName: "Suporte UProperty",
    department: "suporte",
    status: "active",
  },
  {
    id: "cccccccc-3333-4333-8333-cccccccccccc",
    address: "faturacao@upropertymarket.pt",
    displayName: "Faturação",
    department: "financeiro",
    status: "active",
  },
];

export const MAIL_LABELS: MailLabelRow[] = [
  {
    id: "11111111-aaaa-4aaa-8aaa-111111111111",
    mailbox_id: MAILBOXES[0].id,
    name: "Urgente",
    color: "danger",
    created_at: "2026-10-10T09:00:00.000Z",
  },
  {
    id: "22222222-bbbb-4bbb-8bbb-222222222222",
    mailbox_id: MAILBOXES[0].id,
    name: "Faturação",
    color: "info",
    created_at: "2026-10-10T09:05:00.000Z",
  },
];

export const MAIL_LIST: MailListItem[] = [
  {
    id: "dddddddd-1111-4111-8111-dddddddddddd",
    subject: "Não consigo publicar o anúncio da casa de Sintra",
    from_address: "ana.silva@example.pt",
    from_name: "Ana Silva",
    folder: "inbox",
    is_read: false,
    is_starred: true,
    labels: [MAIL_LABELS[0].id],
    ticket_id: null,
    sent_at: "2026-10-13T08:42:00.000Z",
    received_at: "2026-10-13T08:42:30.000Z",
    preview:
      "Boa tarde, carreguei em Publicar e o anúncio continua como rascunho. Já tentei em dois browsers…",
    has_attachments: true,
  },
  {
    id: "eeeeeeee-2222-4222-8222-eeeeeeeeeeee",
    subject: "Re: Fatura de setembro",
    from_address: "rui.esteves@example.pt",
    from_name: "Rui Esteves",
    folder: "inbox",
    is_read: true,
    is_starred: false,
    labels: [MAIL_LABELS[1].id],
    ticket_id: "33333333-cccc-4ccc-8ccc-333333333333",
    sent_at: "2026-10-12T16:20:00.000Z",
    received_at: "2026-10-12T16:20:10.000Z",
    preview: "Obrigado pela ajuda. A fatura já abre no telemóvel, podem fechar o pedido.",
    has_attachments: false,
  },
  {
    id: "ffffffff-3333-4333-8333-ffffffffffff",
    // Assunto longo de propósito: é onde a lista parte se o corte não existir.
    subject:
      "Pedido de visita marcado para sábado às 10h — o proprietário pode confirmar por aqui ou pela app?",
    from_address: "helena.matos@example.pt",
    from_name: "Helena Matos",
    folder: "inbox",
    is_read: true,
    is_starred: false,
    labels: [],
    ticket_id: null,
    sent_at: "2026-10-11T11:05:00.000Z",
    received_at: "2026-10-11T11:05:20.000Z",
    preview: "Olá, confirmo a visita de sábado. Levo a documentação toda.",
    has_attachments: false,
  },
];

export const MAIL_SELECTED: MailMessageRow = {
  id: MAIL_LIST[0].id,
  mailbox_id: MAILBOXES[0].id,
  thread_id: "99999999-9999-4999-8999-999999999999",
  message_id: "<CAF=1234@example.pt>",
  in_reply_to: null,
  from_address: "ana.silva@example.pt",
  from_name: "Ana Silva",
  to_addresses: ["suporte@upropertymarket.pt"],
  cc_addresses: [],
  bcc_addresses: [],
  subject: MAIL_LIST[0].subject,
  html: `<!doctype html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.55;color:#14161a;margin:0;padding:16px">
<p>Boa tarde,</p>
<p>Carreguei em <strong>Publicar</strong> e o anúncio continua como rascunho. Já tentei em dois browsers diferentes e acontece o mesmo.</p>
<table cellpadding="6" style="border-collapse:collapse;font-size:13px">
<tr><td style="border:1px solid #e4e7ec">Anúncio</td><td style="border:1px solid #e4e7ec">Casa em Sintra, T3</td></tr>
<tr><td style="border:1px solid #e4e7ec">Referência</td><td style="border:1px solid #e4e7ec">UPM-2026-0418</td></tr>
</table>
<p>Obrigada,<br>Ana Silva</p>
<p style="font-size:12px;color:#5d6470">Enviado do meu telemóvel · <a href="https://example.pt">example.pt</a></p>
</body></html>`,
  text_body:
    "Boa tarde,\n\nCarreguei em Publicar e o anúncio continua como rascunho. Já tentei em dois browsers diferentes e acontece o mesmo.\n\nObrigada,\nAna Silva",
  folder: "inbox",
  is_read: false,
  is_starred: true,
  labels: [MAIL_LABELS[0].id],
  attachments: [
    { filename: "caderneta-predial.pdf", contentType: "application/pdf", size: 184_320 },
  ],
  ticket_id: null,
  sent_at: "2026-10-13T08:42:00.000Z",
  received_at: "2026-10-13T08:42:30.000Z",
  created_at: "2026-10-13T08:42:30.000Z",
  updated_at: "2026-10-13T08:42:30.000Z",
};

export const MAIL_COUNTS = {
  inbox: 3,
  sent: 0,
  drafts: 0,
  archive: 12,
  unread: 1,
  starred: 1,
};
