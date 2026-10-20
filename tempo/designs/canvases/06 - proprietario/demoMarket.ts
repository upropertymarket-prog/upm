/**
 * Narração de canvas — dados dos ecrãs de imóveis do Proprietário.
 *
 * Separado de `demo.ts` por assunto, não por tamanho: ali estão o painel e a
 * interação (leads, mensagens, visitas), aqui o Market, as propriedades, o
 * mapa e as definições.
 *
 * Tudo fixo, como em `demo.ts`: uma storyboard que renderiza diferente a cada
 * montagem flutua no VRT. Nada aqui lê o relógio nem a rede.
 */
import type { PropertyCardData } from "../../../../apps/app/src/components/market/PropertyCard";
import type { PropertyDetailData } from "../../../../apps/app/src/components/market/PropertyDetail";
import type { PropertyListingRow } from "../../../../apps/app/src/components/my-properties/PropertyListing";
import type { MapProperty } from "../../../../apps/app/src/components/map/mapTypes";
import type { PropertyFormActions } from "../../../../apps/app/src/components/properties/PropertyFormActions";
import type { NotificationPrefs } from "../../../../packages/db/src/interaction";

/**
 * Fotografias de demonstração.
 *
 * SVG em `data:` e não ficheiros nem URLs: uma imagem que vem da rede torna a
 * storyboard dependente de ter ligação e faz o VRT apanhar a diferença entre
 * uma que carregou e uma que não. As cores são literais de propósito — isto é
 * o *conteúdo* que faz de fotografia, não estilo de interface, e 04 §5.1
 * fala do segundo. Nenhuma delas pinta um pixel de UI.
 */
function photo(from: string, to: string): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/>` +
    `</linearGradient></defs><rect width="800" height="600" fill="url(#g)"/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const demoPhotos: string[] = [
  photo("#c7d2dd", "#8fa3b5"),
  photo("#d9cfc2", "#b2a08c"),
  photo("#cdd6cb", "#93a68f"),
  photo("#d5cdd8", "#a294ae"),
];

/* --- Market (/market) -------------------------------------------------- */

export const demoMarketCards: PropertyCardData[] = [
  {
    id: "p1",
    title: "T3 com varanda em Campo de Ourique",
    deal: "sale",
    typology: "T3",
    city: "Lisboa",
    price_cents: 48500000,
    rent_cents: null,
    coverUrl: demoPhotos[0],
  },
  {
    id: "p2",
    title: "T2 renovado junto ao Jardim da Estrela",
    deal: "rent",
    typology: "T2",
    city: "Lisboa",
    price_cents: null,
    rent_cents: 145000,
    coverUrl: demoPhotos[1],
  },
  {
    id: "p3",
    title: "Moradia T4 com jardim em Cascais",
    deal: "sale",
    typology: "T4",
    city: "Cascais",
    price_cents: 92000000,
    rent_cents: null,
    coverUrl: demoPhotos[2],
  },
  {
    id: "p4",
    title: "Loft T0 no centro do Porto",
    deal: "rent",
    typology: "T0",
    city: "Porto",
    price_cents: null,
    rent_cents: 78000,
    coverUrl: demoPhotos[3],
  },
  {
    id: "p5",
    title: "T1 com vista rio em Vila Nova de Gaia",
    deal: "sale",
    typology: "T1",
    city: "Vila Nova de Gaia",
    price_cents: 21500000,
    rent_cents: null,
    coverUrl: demoPhotos[1],
  },
  {
    id: "p6",
    title: "T2 duplex em Alvalade",
    deal: "rent",
    typology: "T2",
    city: "Lisboa",
    price_cents: null,
    rent_cents: 118000,
    coverUrl: demoPhotos[2],
  },
];

/* --- Detalhe (/market/[id]) -------------------------------------------- */

export const demoDetail: PropertyDetailData = {
  ref: "UPM-1041",
  title: "T3 com varanda em Campo de Ourique",
  typology: "T3",
  city: "Lisboa",
  district: "Campo de Ourique",
  description:
    "Apartamento de três assoalhadas num prédio de 1954 totalmente reabilitado em 2021. " +
    "Sala virada a poente com varanda corrida, cozinha equipada e suite com roupeiro embutido. " +
    "A dois minutos a pé do mercado e com estacionamento na rua. Sem obras a prever.",
  grossArea: 118,
  bathrooms: 2,
  floor: "3.º com elevador",
  yearBuilt: 1954,
  energyCert: "B-",
  deal: "sale",
};

/** Campo de Ourique, Lisboa — o raio de 400 m é o que 02 §8 dá a quem não contactou. */
export const demoDetailLocation = {
  lon: -9.1655,
  lat: 38.7154,
  isExact: false,
  radiusM: 400,
};

/* --- As minhas propriedades (/propriedades) ----------------------------- */

/** Os campos que a listagem não mostra ficam neutros — não inventam estado. */
const listingBase = {
  accepts_offers: true,
  address_line: null,
  amenities: [] as string[],
  approx_radius_m: 400,
  bathrooms: 2,
  bedrooms: 3,
  condo_fee_cents: null,
  created_at: "2026-09-02T09:12:00.000Z",
  description: "",
  district: "Lisboa",
  energy_cert: "B-",
  floor: "3.º",
  gross_area: 118,
  imi_cents: null,
  location: null,
  location_approx: null,
  net_area: 104,
  owner_id: "u-ana",
  parish: null,
  postal_code: null,
  property_type: "Apartamento",
  rejection_reason: null,
  show_exact: false,
  submitted_at: "2026-09-03T10:00:00.000Z",
  updated_at: "2026-09-20T16:30:00.000Z",
  year_built: 1954,
};

export const demoListingRows: PropertyListingRow[] = [
  {
    ...listingBase,
    id: "p1",
    ref: "UPM-1041",
    title: "T3 com varanda em Campo de Ourique",
    typology: "T3",
    city: "Lisboa",
    condition: "Usado — bom estado",
    deal: "sale",
    price_cents: 48500000,
    rent_cents: null,
    status: "active",
    published_at: "2026-09-04T11:00:00.000Z",
    views_count: 1245,
    coverUrl: demoPhotos[0],
  },
  {
    ...listingBase,
    id: "p2",
    ref: "UPM-1042",
    title: "T2 renovado junto ao Jardim da Estrela",
    typology: "T2",
    city: "Lisboa",
    condition: "Renovado",
    deal: "rent",
    price_cents: null,
    rent_cents: 145000,
    status: "featured",
    published_at: "2026-09-10T09:30:00.000Z",
    views_count: 862,
    coverUrl: demoPhotos[1],
  },
  {
    ...listingBase,
    id: "p3",
    ref: "UPM-1043",
    title: "Moradia T4 com jardim em Cascais",
    typology: "T4",
    city: "Cascais",
    condition: "Novo",
    deal: "sale",
    price_cents: 92000000,
    rent_cents: null,
    status: "draft",
    published_at: null,
    views_count: 0,
    coverUrl: demoPhotos[2],
  },
  {
    ...listingBase,
    id: "p4",
    ref: "UPM-1039",
    title: "T1 interior em Arroios",
    typology: "T1",
    city: "Lisboa",
    condition: "A recuperar",
    deal: "rent",
    price_cents: null,
    rent_cents: 69000,
    status: "archived",
    published_at: "2026-07-18T08:00:00.000Z",
    views_count: 304,
    coverUrl: demoPhotos[3],
  },
];

/* --- Mapa (/mapa) ------------------------------------------------------- */

export const demoMapProperties: MapProperty[] = [
  {
    id: "p1",
    lon: -9.1655,
    lat: 38.7154,
    price_cents: 48500000,
    deal: "sale",
    title: "T3 Campo de Ourique",
  },
  {
    id: "p2",
    lon: -9.1601,
    lat: 38.7139,
    price_cents: 145000,
    deal: "rent",
    title: "T2 Jardim da Estrela",
  },
  {
    id: "p6",
    lon: -9.1412,
    lat: 38.7498,
    price_cents: 118000,
    deal: "rent",
    title: "T2 duplex em Alvalade",
  },
  {
    id: "p7",
    lon: -9.1503,
    lat: 38.7223,
    price_cents: 31500000,
    deal: "sale",
    title: "T2 Amoreiras",
  },
  {
    id: "p8",
    lon: -9.1789,
    lat: 38.7065,
    price_cents: 56000000,
    deal: "sale",
    title: "T3 Alcântara",
  },
];

/** O Mapa pede uma ação de desenho; no canvas devolve o que já está no ecrã. */
export const demoDrawPolygon = async () => demoMapProperties;

/* --- Nova propriedade (/propriedades/nova) ------------------------------ */

/**
 * As onze Server Actions do wizard, todas inertes. `createDraft` devolve um id
 * fixo em vez de um gerado: o wizard guarda-o em estado e um id aleatório
 * mudava a árvore a cada montagem.
 */
const ok = async () => ({});
export const demoFormActions: PropertyFormActions = {
  createDraft: async () => ({ id: "draft-upm-1044" }),
  saveIdentification: ok,
  saveCharacteristics: ok,
  saveLocation: ok,
  savePrice: ok,
  uploadMedia: ok,
  reorderMedia: ok,
  setCoverMedia: ok,
  deleteMedia: ok,
  uploadDocument: ok,
  publish: ok,
};

/* --- Definições (/definicoes) ------------------------------------------- */

/** Ausente = ligado (`prefEnabled`); aqui desliga-se o e-mail de dois tipos. */
export const demoNotificationPrefs: NotificationPrefs = {
  message: { inapp: true, email: true },
  visit_request: { inapp: true, email: true },
  // 20 out 2026: eram `lead` e `contract`, que **não são tipos de
  // notificação** — o ecrã lista `ACTIVE_NOTIFICATION_TYPES` e estas duas
  // chaves nunca lá estiveram. Trocadas por duas que existem, para a maqueta
  // continuar a mostrar o que existe para mostrar: dois tipos com o e-mail
  // desligado e o sino ligado.
  price_drop: { inapp: true, email: false },
  document_shared: { inapp: true, email: false },
};

export const demoSavePrefs = async () => ({});

/**
 * As duas faixas abaixo do mapa no detalhe. Derivadas de `demoMarketCards`
 * para a storyboard não inventar imóveis que o Market não mostra.
 */
export const demoSimilarCards: PropertyCardData[] = demoMarketCards
  .filter((c) => c.id !== "p1")
  .slice(0, 4);
export const demoOwnerCards: PropertyCardData[] = demoMarketCards
  .filter((c) => c.id !== "p1")
  .slice(-4);
