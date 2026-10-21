import type { CampaignBlock } from "../../../packages/db/src/campaign-blocks";
import type { CampaignSender } from "../../../packages/db/src/campaigns";
import type { AppUpdateRow } from "../../../packages/db/src/updates";
import type {
  CampaignEmailRow,
  CampaignRow,
  ScheduledSendRow,
} from "../../../packages/db/src/campaigns";
import type { StaffFile, StaffFolder } from "../../../apps/interno/src/lib/staff-cloud";

/**
 * Marketing — os dados das storyboards de `/marketing` (P10-07 a P10-10)
 * =========================================================================
 * Ao lado de `mail.ts` e `tickets.ts`, e pela mesma razão: cada ecrã da área
 * aparece em mais do que uma moldura (claro, escuro, e o estado vazio) e duas
 * cópias dos dados divergiriam à primeira alteração.
 *
 * ## As escolhas, e porque é que não são aleatórias
 *
 * - **Uma atualização publicada, uma agendada e um rascunho.** As três são o
 *   que o ecrã distingue com o `StatusTag`, e com todas no mesmo estado não se
 *   via se a distinção existe. A agendada é a única com `scheduled_for`, que é
 *   o campo que só aparece nesse estado.
 * - **Uma campanha enviada e uma em rascunho.** A enviada é a única que tem
 *   números — recibos, aberturas, cliques — e é ela que dá sentido ao ecrã das
 *   Métricas. A de rascunho é o estado em que uma campanha passa a maior parte
 *   da vida.
 * - **Recibos que não fecham a conta de propósito**: 180 entregues de 184
 *   destinatários, com 2 devolvidos. Os outros dois não têm recibo nenhum, que
 *   é o que acontece de verdade — um recibo pode não chegar, e o ecrã tem de
 *   mostrar a percentagem sobre o que sabe, não sobre o que gostaria de saber.
 * - **Um agendamento que falhou.** É o único estado da tabela
 *   `scheduled_sends` que obriga o ecrã a dizer alguma coisa a alguém (P10-09),
 *   e por isso é o que se revê.
 *
 * Nenhum destes dados vai à base de dados, e nenhuma storyboard escreve: ver a
 * nota de cada ficheiro de storyboard.
 */

const AGORA = "2026-10-20T10:00:00.000Z";

/* --- Atualizações (/marketing/atualizacoes) ------------------------------ */

export const UPDATE_ROWS: AppUpdateRow[] = [
  {
    id: "upd-1",
    version: "1.4",
    title: "A Cloud guarda agora os anexos das conversas",
    body_html:
      "<p>Um anexo que receba numa conversa pode passar para a sua Cloud com um clique, sem sair da mensagem.</p><p>O ficheiro fica na pasta do imóvel quando a conversa é sobre um imóvel seu.</p>",
    points: [
      "Guardar na Cloud a partir de qualquer anexo",
      "O histórico de acessos diz quem abriu cada documento",
      "Reciclagem de 30 dias para o que apagar",
    ],
    image_path: null,
    image_alt: "",
    audience: "all",
    status: "published",
    delivery: "banner",
    scheduled_for: null,
    published_at: "2026-10-14T09:00:00.000Z",
    created_by: null,
    created_at: "2026-10-13T16:20:00.000Z",
    updated_at: "2026-10-14T09:00:00.000Z",
  },
  {
    id: "upd-2",
    version: "1.5",
    title: "Contratos: assinar sem sair da plataforma",
    body_html:
      "<p>O editor de contratos passa a congelar a versão que partilha, e a contraparte vê sempre a mesma.</p>",
    points: ["A versão partilhada não muda por trás", "Histórico de versões com autor e data"],
    image_path: null,
    image_alt: "",
    audience: "owners",
    status: "scheduled",
    delivery: "next_login",
    scheduled_for: "2026-10-27T08:00:00.000Z",
    published_at: null,
    created_by: null,
    created_at: "2026-10-19T11:05:00.000Z",
    updated_at: "2026-10-19T11:05:00.000Z",
  },
  {
    id: "upd-3",
    version: "1.6",
    title: "",
    body_html: "",
    points: [],
    image_path: null,
    image_alt: "",
    audience: "buyers",
    status: "draft",
    delivery: "banner",
    scheduled_for: null,
    published_at: null,
    created_by: null,
    created_at: AGORA,
    updated_at: AGORA,
  },
];

/** `update_id` → quantas pessoas já a viram. O rascunho não tem alcance. */
export const UPDATE_REACH: Record<string, number> = { "upd-1": 1284 };

/* --- Campanhas (/marketing/campanhas) ------------------------------------ */

export const CAMPAIGN_ROWS: CampaignRow[] = [
  {
    id: "cmp-1",
    name: "Abertura do Market — proprietários",
    audience: "owners",
    from_mailbox_id: "mbx-1",
    email_bg: "#f6f4f1",
    status: "sent",
    scheduled_at: null,
    sent_at: "2026-10-16T09:00:00.000Z",
    recipients: 184,
    opens: 96,
    clicks: 31,
    bounces: 2,
    unsubscribes: 1,
    created_by: null,
    created_at: "2026-10-12T14:00:00.000Z",
    updated_at: "2026-10-16T09:05:00.000Z",
  },
  {
    id: "cmp-2",
    name: "Pré-inscritos — primeiros anúncios",
    audience: "site_leads_pre",
    from_mailbox_id: "mbx-1",
    email_bg: "#f6f4f1",
    status: "draft",
    scheduled_at: null,
    sent_at: null,
    recipients: 0,
    opens: 0,
    clicks: 0,
    bounces: 0,
    unsubscribes: 0,
    created_by: null,
    created_at: "2026-10-19T15:30:00.000Z",
    updated_at: AGORA,
  },
];

export const CAMPAIGN_EMAILS: CampaignEmailRow[] = [
  {
    id: "eml-1",
    campaign_id: "cmp-1",
    position: 0,
    name: "Convite",
    subject: "As primeiras propriedades já estão no Market",
    preheader: "Sem comissões, e a falar diretamente com quem compra.",
    blocks: null,
    delay: "0 minutes",
    send_at: "2026-10-16T09:00:00.000Z",
    materialized_at: "2026-10-16T09:00:00.000Z",
    created_at: "2026-10-12T14:00:00.000Z",
    updated_at: "2026-10-16T09:00:00.000Z",
  },
  {
    id: "eml-2",
    campaign_id: "cmp-1",
    position: 1,
    name: "Lembrete",
    subject: "Ainda a pensar? Veja quem já publicou",
    preheader: "",
    blocks: null,
    delay: "3 days",
    send_at: null,
    materialized_at: null,
    created_at: "2026-10-12T14:10:00.000Z",
    updated_at: "2026-10-12T14:10:00.000Z",
  },
];

/**
 * Os blocos do primeiro e-mail. Sete dos dez tipos, porque são os que se
 * desenham de maneira diferente — o `divider` e o `spacer` não têm
 * alinhamento, e o `property` e a `signature` leem de outra tabela.
 */
export const CAMPAIGN_BLOCKS: CampaignBlock[] = [
  { id: "b1", type: "header", align: "center", logoPath: "", logoAlt: "UProperty Market" },
  {
    id: "b2",
    type: "heading",
    align: "left",
    text: "As primeiras propriedades já estão no Market",
    level: 1,
  },
  {
    id: "b3",
    type: "text",
    align: "left",
    html: "<p>Publicar é gratuito até ao primeiro anúncio ativo, e quem compra fala diretamente consigo — sem intermediário e sem comissão.</p>",
  },
  { id: "b4", type: "button", align: "center", label: "Ver o Market", href: "https://example.pt" },
  { id: "b5", type: "divider" },
  { id: "b6", type: "signature", align: "left", mailboxId: null },
  {
    id: "b7",
    type: "footer",
    align: "center",
    text: "Recebe este e-mail porque se inscreveu no UProperty Market.",
  },
];

export const CAMPAIGN_BLOCKS_BY_EMAIL: Record<string, CampaignBlock[]> = {
  "eml-1": CAMPAIGN_BLOCKS,
  "eml-2": [],
};

export const CAMPAIGN_DELAY_BY_EMAIL: Record<string, number> = { "eml-1": 0, "eml-2": 4320 };

export const CAMPAIGN_SENDERS: CampaignSender[] = [
  { id: "mbx-1", address: "noticias@upropertymarket.pt", displayName: "UProperty Market" },
  { id: "mbx-2", address: "suporte@upropertymarket.pt", displayName: "Suporte UProperty" },
];

export const CAMPAIGN_PROPERTIES = [
  { id: "11111111-1111-4111-8111-111111111111", label: "T3 em Sintra · 320 000 €" },
  { id: "22222222-2222-4222-8222-222222222222", label: "T2 no Porto · 1 100 €/mês" },
];

/** Ver a nota de topo: a conta não fecha, e é isso que o ecrã tem de mostrar. */
export const CAMPAIGN_RECEIPTS = [
  { type: "delivered" as const, total: 180, people: 180 },
  { type: "opened" as const, total: 142, people: 96 },
  { type: "clicked" as const, total: 38, people: 31 },
  { type: "bounced" as const, total: 2, people: 2 },
  { type: "unsubscribed" as const, total: 1, people: 1 },
];

/** O estado que obriga o ecrã a falar: um agendamento que não disparou. */
export const CAMPAIGN_SCHEDULED: ScheduledSendRow = {
  id: "sch-1",
  kind: "campaign_email",
  ref_id: "eml-2",
  send_at: "2026-10-19T09:00:00.000Z",
  status: "failed",
  created_by: null,
  attempts: 3,
  last_error: "SMTP 421: too many connections from this IP",
  fired_at: "2026-10-19T09:00:12.000Z",
  created_at: "2026-10-16T09:05:00.000Z",
  updated_at: "2026-10-19T09:00:12.000Z",
};

/* --- Cloud interna (/marketing/cloud) ------------------------------------ */

export const STAFF_FOLDERS: StaffFolder[] = [
  { id: "fld-1", name: "Campanhas" },
  { id: "fld-2", name: "Marca" },
];

export const STAFF_FILES: StaffFile[] = [
  {
    id: "stf-1",
    folderId: "fld-1",
    name: "Relatório da campanha de abertura.csv",
    mime: "text/csv",
    size: 18_400,
    bucket: "staff-cloud",
    storagePath: "staff/relatorio-abertura.csv",
    source: "metrics",
    ownerId: "u-mkt",
    ownerName: "Marta Nunes",
    createdAt: "2026-10-17T10:12:00.000Z",
    deletedAt: null,
  },
  {
    id: "stf-2",
    folderId: "fld-2",
    name: "Wordmark UProperty.svg",
    mime: "image/svg+xml",
    size: 4_200,
    bucket: "staff-cloud",
    storagePath: "staff/wordmark.svg",
    source: "upload",
    ownerId: "u-mkt",
    ownerName: "Marta Nunes",
    createdAt: "2026-10-10T08:30:00.000Z",
    deletedAt: null,
  },
  {
    // Na reciclagem: é o estado que a vista "Reciclagem" existe para mostrar.
    id: "stf-3",
    folderId: null,
    name: "Rascunho do e-mail de lançamento.pdf",
    mime: "application/pdf",
    size: 96_000,
    bucket: "staff-cloud",
    storagePath: "staff/rascunho-lancamento.pdf",
    source: "upload",
    ownerId: "u-sup",
    ownerName: "Helena Matos",
    createdAt: "2026-10-05T14:00:00.000Z",
    deletedAt: "2026-10-18T09:00:00.000Z",
  },
];
