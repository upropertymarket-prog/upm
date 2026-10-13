import type {
  MyReportRow,
  SupportTicketDetail,
  SupportTicketRow,
  TicketCounts,
  TicketHistoryRow,
} from "../../../packages/db/src/support";

/**
 * Tickets — os dados das storyboards do Suporte, do Admin e da app
 * =========================================================================
 * **Um ficheiro só, três canvases.** `TicketsManager` aparece em dois sítios —
 * `/suporte/tickets` com o workflow e `/admin/tickets` em `readOnly` (07 §5.10)
 * — e a timeline de quem reportou aparece num terceiro, em `/reports`. Com uma
 * cópia dos dados por canvas, a comparação que estas storyboards existem para
 * permitir ("o Admin vê o mesmo que o Suporte, menos os controlos") deixava de
 * ser verdade no dia em que alguém editasse uma das cópias.
 *
 * Fica fora das pastas dos canvases, ao lado de `_narration/`, pela mesma
 * razão: não é uma storyboard, é material partilhado.
 *
 * ## As escolhas dos dados não são decorativas
 *
 * - **As quatro gravidades e cinco estados aparecem todos**, porque é a coluna
 *   de etiquetas que este ecrã tem de provar: `StatusTag` tinge por
 *   significado (04 §5.6) e um ecrã com tudo `medium`/`new` não mostra nada.
 * - **Há um ticket `auto` e tickets `report`**: a etiqueta de origem distingue
 *   o que nasceu de um erro de consola do que alguém escreveu, e as duas
 *   formas convivem na mesma fila.
 * - **O detalhe tem `console_errors` e `breadcrumbs`** — é o bloco de factos
 *   técnicos de 04 §2.6, e é onde o ecrã parte se o texto for comprido. A
 *   mensagem de erro aqui tem o comprimento que estas mensagens têm a sério.
 * - **Nenhum breadcrumb tem conteúdo de mensagem ou de documento**, que é a
 *   promessa de 04 §2.7 #2. Uma storyboard que a quebrasse ensinava o contrário
 *   a quem a lesse.
 * - **As datas são fixas.** Nada aqui pode depender do relógio: duas montagens
 *   da mesma storyboard têm de dar o mesmo pixel.
 */

export const TICKET_COUNTS: TicketCounts = {
  pending: 3,
  inProgress: 2,
  awaitingConfirmation: 1,
  closed: 24,
};

export const TICKET_ROWS: SupportTicketRow[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    ref: "AGXZ-NKGE",
    title: "O mapa fica em branco ao desenhar uma área em Lisboa",
    severity: "critical",
    status: "new",
    origin: "auto",
    route: "/mapa",
    reporter_name: "Ana Silva",
    occurrences: 14,
    affected_users: 9,
    last_seen_at: "2026-10-13T09:42:00.000Z",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    ref: "QWRT-BZLM",
    title: "Não consigo anexar o PDF da certidão à propriedade",
    severity: "high",
    status: "triage",
    origin: "report",
    route: "/propriedades/nova",
    reporter_name: "Rui Esteves",
    occurrences: 3,
    affected_users: 3,
    last_seen_at: "2026-10-12T16:05:00.000Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    ref: "LMPD-7TQA",
    // Título longo de propósito: é onde a lista parte se o corte não existir.
    title:
      "Ao reagendar uma visita pela segunda vez, a hora que aparece no e-mail não é a hora que escolhi",
    severity: "medium",
    status: "new",
    origin: "report",
    route: "/agenda",
    reporter_name: "Helena Matos",
    occurrences: 2,
    affected_users: 2,
    last_seen_at: "2026-10-11T11:20:00.000Z",
  },
  {
    id: "44444444-4444-4444-8444-444444444444",
    ref: "KJ3R-WSDC",
    title: "O contador de Guardados não baixa quando removo um imóvel",
    severity: "low",
    status: "triage",
    origin: "both",
    route: "/guardados",
    reporter_name: "Pedro Nunes",
    occurrences: 1,
    affected_users: 1,
    last_seen_at: "2026-10-10T08:15:00.000Z",
  },
];

/** O ticket aberto no detalhe — o primeiro da fila. */
export const TICKET_DETAIL: SupportTicketDetail = {
  id: TICKET_ROWS[0].id,
  ref: TICKET_ROWS[0].ref,
  title: TICKET_ROWS[0].title,
  description:
    "Desenhei uma área no mapa em Lisboa e o mapa ficou todo branco.\nTentei outra vez e aconteceu o mesmo. Só volta ao normal se recarregar a página.",
  severity: "critical",
  status: "new",
  origin: "auto",
  route: "/mapa",
  reporter_name: "Ana Silva",
  reporter_role: "owner",
  occurrences: 14,
  affected_users: 9,
  first_seen_at: "2026-10-09T10:02:00.000Z",
  last_seen_at: "2026-10-13T09:42:00.000Z",
  fix_note: "",
  build_sha: "8bd8f63",
  browser: "Chrome 141",
  os: "Windows 11",
  viewport: "1512×852",
  network: "4g",
  session_id: "sess_9f2a41c7",
  screenshot_path: "",
  technical_purged_at: "",
  console_errors: [
    "TypeError: Cannot read properties of undefined (reading 'getBounds') at DrawArea.tsx:118",
  ],
  breadcrumbs: [
    { at: "09:41:48", kind: "navigation", label: "/mapa" },
    { at: "09:41:55", kind: "click", label: "Desenhar área" },
    { at: "09:42:03", kind: "click", label: "Concluir área" },
    { at: "09:42:03", kind: "error", label: "TypeError: getBounds of undefined" },
  ],
};

export const TICKET_HISTORY: TicketHistoryRow[] = [
  {
    status_from: "new",
    status_to: "triage",
    note: "Reproduzido em Chrome e Firefox.",
    actor_name: "Helena Matos",
    occurred_at: "2026-10-13T10:05:00.000Z",
  },
];

/**
 * "Os meus reports" — o outro lado da mesma fila (07 §5.11).
 *
 * Os três estão em passos diferentes de propósito: o ecrã mostra os cinco
 * passos sempre, com o atual assinalado, e com todos no mesmo passo não se via
 * se o assinalado é o certo. O resolvido tem `fix_note`, que é o texto que 04
 * §2.7 #5 promete a quem reportou — e o único sítio onde ele se lê.
 */
export const MY_REPORTS: MyReportRow[] = [
  {
    id: TICKET_ROWS[0].id,
    ref: "AGXZ-NKGE",
    title: "O mapa fica em branco ao desenhar uma área em Lisboa",
    severity: "critical",
    status: "in_progress",
    fix_note: "",
    created_at: "2026-10-09T10:02:00.000Z",
    last_seen_at: "2026-10-13T09:42:00.000Z",
  },
  {
    id: "55555555-5555-4555-8555-555555555555",
    ref: "BNM4-XQPL",
    title: "A fatura de setembro não abre no telemóvel",
    severity: "medium",
    status: "awaiting_confirmation",
    fix_note: "",
    created_at: "2026-10-02T14:30:00.000Z",
    last_seen_at: "2026-10-08T09:10:00.000Z",
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    ref: "TRQ8-HJ2V",
    title: "Recebi duas vezes a notificação do mesmo pedido de visita",
    severity: "low",
    status: "closed",
    fix_note:
      "As notificações passaram a ser agrupadas por pedido, por isso um reagendamento já não gera um segundo aviso. Corrigido na versão de 6 de outubro.",
    created_at: "2026-09-24T08:45:00.000Z",
    last_seen_at: "2026-10-06T17:00:00.000Z",
  },
];
