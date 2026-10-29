/**
 * Narração de canvas — dados de demonstração do canvas do Comprador.
 *
 * Valores fixos de propósito, pela mesma razão do `demo.ts` do proprietário: o
 * `buildViewsSeries` da app lê o relógio, e uma storyboard que renderiza
 * diferente a cada montagem flutua no VRT.
 *
 * ## A mesma história, do outro lado
 *
 * O comprador é o **João Costa**, que já existe nas fixtures do canvas 06 como
 * o interessado no T3 de Campo de Ourique. Não é coincidência nem preguiça: o
 * canvas do proprietário mostra a Ana Silva a receber um pedido de visita, e
 * este mostra quem o fez. Quem percorrer os dois canvases vê o mesmo negócio
 * das duas pontas, com os mesmos imóveis, as mesmas datas e as mesmas frases.
 * Inventar um elenco novo tornaria as duas metades irreconciliáveis.
 */
import type {
  DashboardStat,
  ViewsSeries,
} from "../../../../apps/app/src/components/dashboard/dashboardTypes";
import type { ActivityItem } from "../../../../apps/app/src/components/dashboard/RecentActivity";
import type { VisitRow } from "../../../../apps/app/src/components/interaction/interactionTypes";
import type { SearchAlertItem } from "../../../../apps/app/src/components/market/AlertsManager";

/** Ancorado a 29 set 2026, o dia dos protótipos — como no canvas 06. */
const DIA = "2026-09-29T";

export const demoLocaleChange = () => undefined;

/** Nenhuma storyboard escreve: não há sessão nem servidor por trás. */
export const demoOk = async () => ({});

/**
 * Os quatro KPIs de 04 §2.4, pela ordem em que o `BuyerPanel` os monta:
 * guardados, visitas, conversas e documentos.
 *
 * "Documentos" são os contratos partilhados com esta pessoa — a leitura que
 * fechou D29. Os tons não são decorativos: `warn` nas visitas porque há uma por
 * confirmar, e é isso que o comprador tem de ir fazer.
 */
export const demoBuyerStats: DashboardStat[] = [
  {
    id: "saved",
    icon: "saved",
    label: "Imóveis guardados",
    value: "3",
    delta: "um baixou de preço",
    deltaTone: "ok",
  },
  {
    id: "visits",
    icon: "visits",
    label: "Visitas pedidas",
    value: "3",
    delta: "1 por confirmar",
    deltaTone: "warn",
  },
  {
    id: "messages",
    icon: "messages",
    label: "Conversas",
    value: "2",
    delta: "1 por responder",
    deltaTone: "warn",
  },
  {
    id: "contracts",
    icon: "contracts",
    label: "Documentos",
    value: "1",
    delta: "partilhado consigo",
    deltaTone: "ok",
  },
];

/**
 * "Imóveis vistos" (D45) — a série de `my_property_views_daily`.
 *
 * Números de uma pessoa a procurar casa, não de um anúncio a ser procurado: as
 * dezenas do comprador contra os milhares do proprietário no canvas 06. Um
 * gráfico com a escala errada diz ao revisor que o ecrã é do outro papel.
 */
export const demoViewsSeries: ViewsSeries[] = [
  {
    id: "7d",
    label: "7 dias",
    buckets: [
      { label: "qua", value: 6, srLabel: "23 de setembro" },
      { label: "qui", value: 11, srLabel: "24 de setembro" },
      { label: "sex", value: 4, srLabel: "25 de setembro" },
      { label: "sáb", value: 18, srLabel: "26 de setembro" },
      { label: "dom", value: 14, srLabel: "27 de setembro" },
      { label: "seg", value: 2, srLabel: "28 de setembro" },
      { label: "ter", value: 9, srLabel: "29 de setembro" },
    ],
  },
  {
    id: "30d",
    label: "30 dias",
    buckets: [
      { label: "s1", value: 21, srLabel: "Semana de 2 a 8 de setembro" },
      { label: "s2", value: 34, srLabel: "Semana de 9 a 15 de setembro" },
      { label: "s3", value: 48, srLabel: "Semana de 16 a 22 de setembro" },
      { label: "s4", value: 64, srLabel: "Semana de 23 a 29 de setembro" },
    ],
  },
  {
    /**
     * Os três primeiros meses a zero não são um buraco nos dados: a retenção
     * do `my_property_views_daily` corta aos 90 dias, por decisão do cliente.
     * O seletor de 12 meses mostra isso de propósito — é o ecrã a dizer que
     * não guarda o que não precisa de guardar.
     */
    id: "12m",
    label: "12 meses",
    buckets: [
      { label: "out", value: 0, srLabel: "outubro de 2025" },
      { label: "nov", value: 0, srLabel: "novembro de 2025" },
      { label: "dez", value: 0, srLabel: "dezembro de 2025" },
      { label: "jan", value: 0, srLabel: "janeiro de 2026" },
      { label: "fev", value: 0, srLabel: "fevereiro de 2026" },
      { label: "mar", value: 0, srLabel: "março de 2026" },
      { label: "abr", value: 0, srLabel: "abril de 2026" },
      { label: "mai", value: 0, srLabel: "maio de 2026" },
      { label: "jun", value: 0, srLabel: "junho de 2026" },
      { label: "jul", value: 31, srLabel: "julho de 2026" },
      { label: "ago", value: 96, srLabel: "agosto de 2026" },
      { label: "set", value: 167, srLabel: "setembro de 2026" },
    ],
  },
];

/** Do lado do comprador a contraparte é sempre a proprietária, a Ana Silva. */
export const demoRecentMessages: ActivityItem[] = [
  {
    id: "c1",
    title: "Ana Silva · T3 Campo de Ourique",
    subtitle: "«É individual, com portão automático e arrecadação anexa.»",
    href: "/mensagens?conversa=c1",
    tag: "Novo",
    tone: "new",
  },
  {
    id: "c2",
    title: "Ana Silva · Moradia T4 Birre",
    subtitle: "«O anexo está convertido e licenciado.»",
    href: "/mensagens?conversa=c2",
    tag: "Lido",
    tone: "archived",
  },
];

/**
 * Um contrato só, e por assinar. O comprador não acumula contratos como o
 * proprietário acumula: tem o do negócio que está a fazer, e é esse que o
 * painel tem para lhe mostrar.
 */
export const demoRecentContracts: ActivityItem[] = [
  {
    id: "c1",
    title: "Contrato de reserva · Apartamento T3",
    subtitle: "com Ana Silva · há 2 dias",
    href: "/contratos/c1",
    tag: "Por assinar",
    tone: "pending",
  },
];

/** O sino, do lado de quem procura: respostas e confirmações, não pedidos. */
export const demoNotifications = [
  {
    id: "n1",
    text: "Visita confirmada — Loft T1 Marvila, 1 out às 18h00.",
    when: "há 20 minutos",
    read: false,
    href: "/meus-pedidos",
  },
  {
    id: "n2",
    text: "Baixa de preço — Apartamento T3 com varanda passou de 420 000 € para 395 000 €.",
    when: "há 3 horas",
    read: false,
    href: "/guardados",
  },
  {
    id: "n3",
    text: "Nova mensagem de Ana Silva — «É individual, com portão automático.»",
    when: "há 1 dia",
    read: true,
    href: "/mensagens",
  },
];

// ---------------------------------------------------------------------------
// Guardados — `/guardados`
// ---------------------------------------------------------------------------

/**
 * A linha da tabela de guardados, como a página a monta.
 *
 * O tipo é local porque o `page.tsx` não o exporta: o ecrã dos Guardados ainda
 * não tem componente de apresentação próprio, e monta a `Table` em linha no
 * componente de servidor. Ver a nota de topo do `Guardados.tsx`.
 */
export type DemoSavedRow = {
  id: string;
  propertyId: string;
  title: string;
  deal: "sale" | "rent" | null;
  priceAtSave: number | null;
  currentPrice: number | null;
};

/**
 * Três linhas, e cada uma existe para mostrar um caso da última coluna:
 * desceu, subiu, e não mexeu. É a coluna que justifica este ecrã existir —
 * guardar um imóvel serve para dar pela mudança de preço — e uma tabela em que
 * os três preços estivessem iguais não mostrava nada disso.
 */
export const demoSaved: DemoSavedRow[] = [
  {
    id: "s1",
    propertyId: "p3",
    title: "Apartamento T3 com varanda · Campo de Ourique",
    deal: "sale",
    priceAtSave: 42_000_000,
    currentPrice: 39_500_000,
  },
  {
    id: "s2",
    propertyId: "p1",
    title: "Moradia T4 com jardim · Cascais, Birre",
    deal: "sale",
    priceAtSave: 78_000_000,
    currentPrice: 81_000_000,
  },
  {
    id: "s3",
    propertyId: "p2",
    title: "Loft industrial T1 · Lisboa, Marvila",
    deal: "rent",
    priceAtSave: 135_000,
    currentPrice: 135_000,
  },
];

// ---------------------------------------------------------------------------
// Alertas de pesquisa — `/guardados/alertas`
// ---------------------------------------------------------------------------

/**
 * Dois alertas, com recortes diferentes de propósito: um fecha o preço por
 * cima e o outro por baixo, e só um nomeia cidade. O `AlertsManager` resume
 * cada alerta numa frase a partir dos filtros, e com dois alertas iguais não
 * se via que o resumo muda.
 */
export const demoAlerts: SearchAlertItem[] = [
  {
    id: "a1",
    filters: {
      deal: "sale",
      property_type: "Apartamento",
      typology: "T3",
      price_max_cents: 45_000_000,
      city: "Lisboa",
    },
  },
  {
    id: "a2",
    filters: {
      deal: "rent",
      property_type: "Apartamento",
      price_min_cents: 100_000,
      price_max_cents: 150_000,
    },
  },
];

/** O `AlertsManager` escreve de verdade na app; aqui nenhuma ação sai daqui. */
export const demoAlertOk = async () => ({ ok: true });

// ---------------------------------------------------------------------------
// Meus pedidos — `/meus-pedidos`
// ---------------------------------------------------------------------------

/**
 * As mesmas visitas do canvas 06, invertidas.
 *
 * Lá, a Ana Silva vê pedidos que lhe chegam (`proposedByMe: false`); aqui é o
 * João a ver os que fez (`proposedByMe: true`), e a contraparte passa a ser
 * ela. As datas e os imóveis são os mesmos de propósito: é o mesmo negócio.
 *
 * Três estados, porque é neles que o ecrã se decide: um por confirmar (o que
 * tem ações), um aceite (o que já tem hora) e um remarcado pela proprietária,
 * que é o caso em que o comprador tem de responder a uma contraproposta.
 */
export const demoVisits: VisitRow[] = [
  {
    id: "v3",
    propertyId: "p3",
    propertyTitle: "Apartamento T3 com varanda",
    propertyLocation: "Lisboa · Campo de Ourique",
    other: { id: "u0", name: "Ana Silva", initials: "AS" },
    proposedAt: "2026-10-03T11:00:00Z",
    message: "Seria possível visitar sábado de manhã?",
    status: "pending",
    rescheduleCount: 0,
    proposedByMe: true,
  },
  {
    id: "v2",
    propertyId: "p2",
    propertyTitle: "Loft industrial T1",
    propertyLocation: "Lisboa · Marvila",
    other: { id: "u0", name: "Ana Silva", initials: "AS" },
    proposedAt: "2026-10-01T18:00:00Z",
    message: "",
    status: "accepted",
    rescheduleCount: 2,
    proposedByMe: true,
  },
  {
    id: "v1",
    propertyId: "p1",
    propertyTitle: "Moradia T4 com jardim",
    propertyLocation: "Cascais · Birre",
    other: { id: "u0", name: "Ana Silva", initials: "AS" },
    proposedAt: `${DIA}16:30:00Z`,
    message: "Proponho antes quinta às 16h30, se lhe der jeito.",
    status: "rescheduled",
    rescheduleCount: 1,
    proposedByMe: false,
  },
];
