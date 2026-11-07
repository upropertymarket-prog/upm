/**
 * Estrutura do site público (P2-01 · 04 §2.1)
 * =========================================================================
 * **Extraído do protótipo**, não reescrito: `design/prototypes/UProperty
 * Market - Pré lançamento.dc.html` é a fonte visual aprovada (04 Anexo B).
 *
 * ---------------------------------------------------------------------------
 * O TEXTO SAIU DAQUI A 20 OUT 2026 (D72)
 * ---------------------------------------------------------------------------
 * Até aqui este ficheiro guardava a copy inteira do site. A razão escrita era
 * boa — "é copy, muda por decisão de marketing e não por refactor, e quem a
 * vier mudar não deve ter de atravessar JSX para a achar" — e continua a ser
 * verdade. O que ela não previu é que o produto é bilingue (02 §12): uma
 * constante de módulo é avaliada **uma vez, no arranque**, e por isso ficava
 * presa ao idioma em que foi escrita. O seletor de idioma do site mudava o
 * resto da página e não lhe tocava.
 *
 * Hoje o texto vive em `packages/config/messages/*.json`, no namespace `site`,
 * e o argumento de origem fica **mais forte**: a copy continua num ficheiro só,
 * longe do JSX, e passou a estar lado a lado com a sua tradução — quem muda uma
 * frase vê logo a outra que tem de acompanhar.
 *
 * O que fica aqui é o que **não é texto**: a ordem das secções, os `id` das
 * âncoras, os ícones de cada cartão e os `href` do rodapé. São estrutura, não
 * conteúdo, e não mudam com o idioma — um `href` traduzido seria um 404.
 *
 * As quatro correções ao protótipo aprovadas a 7 out 2026 (P9-05, o fim da
 * conta gratuita) continuam aplicadas; vivem agora no texto das chaves
 * `site.hero.primaryCta`, `site.pricing.body` e `site.faq.items.cost` /
 * `site.faq.items.availability`.
 */

export type IconName =
  | "handshake"
  | "banknote"
  | "calendar-check"
  | "cloud"
  | "message-square"
  | "map-pin"
  | "bell-ring"
  | "badge-percent"
  | "building-2"
  | "shield-check"
  | "layout-dashboard"
  | "file-signature"
  | "scale"
  | "eye";

/**
 * Um cartão já resolvido, pronto a desenhar. O `FeatureGrid` recebe isto —
 * rótulos por prop, como os componentes de `@upm/ui` — e quem o monta é que
 * traduz.
 */
export type FeatureCard = { icon: IconName; title: string; body: string };

/**
 * Um cartão antes de ter texto: o ícone, que é desenho, e a chave por onde o
 * título e o corpo se vão buscar.
 */
export type FeatureCardRef = { icon: IconName; id: string };

/** Os cartões de "Em breve", pela ordem do protótipo. */
export const COMING_SOON_CARDS: readonly FeatureCardRef[] = [
  { icon: "bell-ring", id: "launchAlert" },
  { icon: "badge-percent", id: "preLaunchPrice" },
  { icon: "building-2", id: "publishFirst" },
  { icon: "message-square", id: "directChat" },
];

/** As duas audiências de 04 §2.1 e os seis cartões de cada uma. */
export const AUDIENCE_IDS = ["particulares", "empresas"] as const;
export type AudienceId = (typeof AUDIENCE_IDS)[number];

export const AUDIENCE_CARDS: Record<AudienceId, readonly FeatureCardRef[]> = {
  particulares: [
    { icon: "handshake", id: "bureaucracy" },
    { icon: "banknote", id: "noCommission" },
    { icon: "calendar-check", id: "visits" },
    { icon: "cloud", id: "cloud" },
    { icon: "message-square", id: "directChat" },
    { icon: "map-pin", id: "honestLocation" },
  ],
  empresas: [
    { icon: "handshake", id: "proximity" },
    { icon: "layout-dashboard", id: "centralized" },
    { icon: "file-signature", id: "contracts" },
    { icon: "cloud", id: "docsPerProject" },
    { icon: "shield-check", id: "dataProtected" },
    { icon: "banknote", id: "noCommission" },
  ],
};

/**
 * Os três valores, em cartões por baixo de "A nossa missão" (6 nov 2026).
 * Eram uma lista curta dentro de "Sobre nós"; voltaram a ser cartões, como no
 * site de pré-lançamento anterior, porque são o argumento da missão e não um
 * pormenor do "Sobre". As chaves continuam em `site.about.points`.
 */
export const MISSION_VALUE_CARDS: readonly FeatureCardRef[] = [
  { icon: "scale", id: "fairMarket" },
  { icon: "handshake", id: "freedom" },
  { icon: "eye", id: "transparency" },
];

/** Os três números do hero. */
export const HERO_STAT_IDS = ["commission", "privacy", "everything"] as const;

/** As abas de público e de periodicidade da secção de preços. */
// `builder` não tem planos no catálogo: o separador mostra que estão a ser
// preparados e leva ao contacto (6 nov 2026). Quando houver planos com
// `audience = "builder"`, aparecem aqui sem mudar o componente.
export const PRICING_AUDIENCE_IDS = ["owner", "buyer", "builder"] as const;
export const PRICING_BILLING_IDS = ["year", "month"] as const;

/** As dúvidas, pela ordem em que se respondem. */
export const FAQ_IDS = [
  "availability",
  "cost",
  "professional",
  "mobile",
  "contactVisible",
  "bug",
] as const;

/** Os motivos de contacto. O `value` é o que vai no formulário e na base. */
export const CONTACT_REASON_VALUES = ["vender", "comprar", "planos", "suporte"] as const;

/**
 * O rodapé de cinco colunas de 04 §2.1 — só a estrutura. Os destinos ficam
 * aqui de propósito: um caminho não se traduz, e traduzi-lo dava um 404.
 *
 * **`anchor` e `route` são campos diferentes, e isso é deliberado** (20 out
 * 2026). Eram os dois um `href`, e o rodapé decidia entre `<a>` e `<Link>` com
 * um `href.startsWith("#")`. Funcionava e deixou de compilar quando os
 * caminhos passaram a ser tipados: um `"#sobre"` não é uma rota do site, e o
 * TypeScript não estreita uma união de literais por um `startsWith`.
 *
 * A correção certa não era um cast. Uma âncora da mesma página e uma rota são
 * **duas coisas diferentes** — uma não leva prefixo de idioma, a outra leva —
 * e passam a dizer-se por nomes diferentes. O rodapé escolhe por `"route" in
 * link`, que o compilador entende, e um destino novo tem de declarar qual dos
 * dois é.
 */
export const FOOTER_COLUMNS = [
  {
    id: "platform",
    links: [
      { id: "about", anchor: "#sobre" },
      { id: "how", anchor: "#plataforma" },
      { id: "business", anchor: "#empresas" },
      { id: "pricing", anchor: "#precos" },
    ],
  },
  {
    id: "start",
    links: [
      { id: "preRegistration", route: "/pre-inscricao" },
      // Só depois do lançamento: em `pre` não há contas, e o `/entrar` volta à
      // página de pré-lançamento — um link que não leva a lado nenhum.
      { id: "signIn", route: "/entrar", postOnly: true },
    ],
  },
  {
    id: "support",
    links: [
      { id: "faq", anchor: "#duvidas" },
      { id: "contact", anchor: "#contactos" },
    ],
  },
  {
    id: "terms",
    links: [
      { id: "terms", route: "/termos" },
      { id: "privacy", route: "/privacidade" },
      { id: "cookies", route: "/cookies" },
    ],
  },
] as const;

/** As âncoras da navbar, na ordem do protótipo. */
export const NAV_ANCHOR_IDS = [
  "plataforma",
  "sobre",
  "empresas",
  "precos",
  "duvidas",
  "contactos",
] as const;

/**
 * As redes sociais do rodapé. Um endereço vazio não desenha o ícone: é assim
 * que se entra sem conta e se liga quando a conta existir, sem mexer no JSX.
 */
export const SOCIAL_LINKS = {
  instagram: "",
  youtube: "",
} as const satisfies Record<"instagram" | "youtube", string>;

/**
 * As fotografias do site (6 e 7 nov 2026)
 * ---------------------------------------------------------------------------
 * Fotos de banco, entregues pelo cliente e otimizadas a 7 nov: WebP, largura
 * de quem as mostra (1600 px no hero e na faixa, 1200 nas outras), sem
 * metadados, 47 a 70 KB cada (os originais tinham 1 a 4 MB). A missão e a
 * faixa eram verticais e foram recortadas na origem para o lugar horizontal,
 * com as caras e o espelho dentro do enquadramento — cortadas pelo browser,
 * perdiam o assunto. Os originais não entram no repositório.
 *
 * O nome do ficheiro diz o que a fotografia mostra (é lido pelos motores de
 * busca); o texto alternativo, nas duas línguas, está em `site.*.imageLabel`.
 * `width`/`height` são os do ficheiro: o browser reserva o espaço antes de a
 * imagem chegar. `null` volta a desenhar o espaço reservado.
 */
export type SiteImageFile = { src: string; width: number; height: number };

export const SITE_IMAGES: Record<
  "hero" | "about" | "mission" | "business" | "banner",
  SiteImageFile | null
> = {
  hero: { src: "/site/sala-de-estar-moderna-sem-comissoes.webp", width: 1600, height: 1136 },
  about: { src: "/site/comprar-e-vender-casa-online.webp", width: 1200, height: 900 },
  mission: { src: "/site/familia-com-recem-nascido-em-casa.webp", width: 1200, height: 900 },
  business: { src: "/site/gestao-de-obra-no-setor-da-construcao.webp", width: 1200, height: 900 },
  banner: { src: "/site/quarto-moderno-com-espelho-redondo.webp", width: 1600, height: 800 },
};
export type SiteImageSlot = keyof typeof SITE_IMAGES;
