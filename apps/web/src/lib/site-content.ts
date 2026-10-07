/**
 * Conteúdo do site público (P2-01 · 04 §2.1)
 * =========================================================================
 * **Extraído do protótipo**, não reescrito: `design/prototypes/UProperty
 * Market - Pré lançamento.dc.html` é a fonte visual aprovada (04 Anexo B), e
 * o texto é o que lá está. Vive aqui, num ficheiro só, e não espalhado pelos
 * componentes, porque é copy — muda por decisão de marketing, não por
 * refactor, e quem a vier mudar não deve ter de atravessar JSX para a achar.
 *
 * ---------------------------------------------------------------------------
 * QUATRO CORREÇÕES AO PROTÓTIPO, aprovadas pelo cliente a 7 out 2026
 * ---------------------------------------------------------------------------
 * O protótipo é anterior a **P9-05** — a decisão de 7 out de acabar com a
 * conta gratuita ("o user, no momento em que pretende inscrever-se, tem logo
 * de pagar", 07 §23.2). Em quatro sítios o texto prometia o contrário do que
 * o registo faz. Cada um está marcado com `CORRIGIDO` no sítio onde vive:
 *
 *   1. CTA do hero: "Criar conta grátis" → "Começar agora".
 *   2. Subtítulo dos preços: deixou de dizer "Comece grátis".
 *   3. Dúvida "A plataforma é gratuita?" → "Quanto custa usar a plataforma?".
 *   4. Dúvida #1 deixou de dizer "beta aberto" — o modo é pré-lançamento.
 *
 * A quinta contradição — o plano Gratuito na escada de preços — não precisou
 * de correção aqui: os planos vêm de `plans` com `visible = true`, e
 * `20261007120500_end_free_plan.sql` já pôs o gratuito a `false`.
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
  | "file-signature";

export type FeatureCard = { icon: IconName; title: string; body: string };

/** A faixa de topo, visível só em pré-lançamento. */
export const PRE_LAUNCH_BANNER = "Plataforma em pré-lançamento — pré-inscrição disponível";

export const HERO = {
  eyebrow: "Your property your choice",
  title: "Imóveis sem comissões, nem contactos indesejados.",
  body: "Compradores e proprietários falam diretamente, no seu ritmo, com informação transparente e controlo total do processo. Sem intermediários, sem pressões, sem surpresas no fim.",
  // CORRIGIDO (1): o protótipo dizia "Criar conta grátis".
  primaryCta: "Começar agora",
  secondaryCta: "Ver a plataforma",
  stats: ["0 % de comissão", "100 % contactos privados", "4 perfis numa só plataforma"],
  imageLabel: "fotografia principal · interior",
} as const;

export const PLATFORM = {
  eyebrow: "A plataforma",
  title: "Organize, comunique e venda — tudo num único painel.",
  body: "Experimente aqui mesmo. Escolha um perfil e navegue pelo painel real da plataforma.",
} as const;

export const ABOUT = {
  eyebrow: "Sobre nós",
  title: "Uma solução digital para simplificar a compra e venda de imóveis.",
  body: "A UProperty Market torna o processo mais simples e direto: comunica de forma segura, por chat, sem necessidade de intermediários, sem partilha de contactos pessoais e sem comissões sobre a venda.",
  imageLabel: "fotografia · equipa",
  points: [
    { title: "Mercado mais justo", body: "Oportunidades reais, sem especulação sobre o preço." },
    { title: "Liberdade para negociar", body: "Diálogo aberto entre quem compra e quem vende." },
    { title: "Transparência", body: "Informação completa e verificada em cada anúncio." },
  ],
} as const;

export const BUSINESS = {
  eyebrow: "Para empresas",
  title: "Solução integrada de gestão para o setor da construção.",
  body: "Na UProperty Market, terá acesso a um sistema integrado com ferramentas desenvolvidas especificamente para as necessidades do setor da construção. Centralize toda a informação da sua empresa num único local, sempre acessível e com dados atualizados em tempo real.",
  primaryCta: "Pré-inscrição",
  secondaryCta: "Contacte-nos",
  imageLabel: "fotografia · obra em construção",
} as const;

/** A secção "Em breve", que o modo pós-lançamento substitui por imóveis reais. */
export const COMING_SOON = {
  eyebrow: "Em breve",
  title: "Os primeiros imóveis estão a caminho",
  body: "Ainda não há imóveis publicados. Estamos a preparar o arranque com os primeiros proprietários — faça a sua pré-inscrição agora e seja avisado assim que os anúncios abrirem.",
  primaryCta: "Quero ser avisado",
  secondaryCta: "Ver pré-visualização",
  cards: [
    {
      icon: "bell-ring",
      title: "Alerta de arranque",
      body: "Avisamos por email quando os primeiros anúncios entrarem.",
    },
    {
      icon: "badge-percent",
      title: "Preço de pré-lançamento",
      body: "Quem se inscreve agora mantém o valor de lançamento.",
    },
    {
      icon: "building-2",
      title: "Publicar primeiro",
      body: "Proprietários inscritos publicam antes da abertura pública.",
    },
    {
      icon: "message-square",
      title: "Acesso ao chat direto",
      body: "Fale com quem vende assim que o primeiro anúncio abrir.",
    },
  ] satisfies FeatureCard[],
} as const;

export const AUDIENCES = {
  tabs: [
    { id: "particulares", label: "Particulares" },
    { id: "empresas", label: "Empresas" },
  ],
  particulares: {
    title: "Para particulares",
    cards: [
      {
        icon: "handshake",
        title: "Apoio burocrático",
        body: "Informações claras e apoio personalizado para o orientar em cada passo da venda ou arrendamento.",
      },
      {
        icon: "banknote",
        title: "Sem comissões",
        body: "Venda ao seu ritmo, sem intermediários. O valor da venda é 100% seu.",
      },
      {
        icon: "calendar-check",
        title: "Agenda de visitas",
        body: "Todas as visitas centralizadas, com confirmação e lembretes automáticos.",
      },
      {
        icon: "cloud",
        title: "Documentação na cloud",
        body: "Certidões, plantas e contratos organizados por imóvel, sempre acessíveis.",
      },
      {
        icon: "message-square",
        title: "Conversas diretas",
        body: "Fale apenas com quem está realmente interessado, sem partilhar contactos.",
      },
      {
        icon: "map-pin",
        title: "Localização honesta",
        body: "Mapa aproximado antes do contacto, morada exata depois de aceite.",
      },
    ] satisfies FeatureCard[],
  },
  empresas: {
    title: "Para empresas",
    cards: [
      {
        icon: "handshake",
        title: "Proximidade",
        body: "Reduz intermediários entre o cliente final e os seus imóveis.",
      },
      {
        icon: "layout-dashboard",
        title: "Gestão centralizada",
        body: "Toda a informação da empresa num local só, atualizada em tempo real.",
      },
      {
        icon: "file-signature",
        title: "Contratos digitais",
        body: "Modelos, versões e assinatura, sem sair da plataforma.",
      },
      {
        icon: "cloud",
        title: "Documentação por obra",
        body: "Plantas, licenças e certidões organizadas por empreendimento.",
      },
      {
        icon: "shield-check",
        title: "Dados protegidos",
        body: "Acessos por perfil e registo de quem consultou cada documento.",
      },
      {
        icon: "banknote",
        title: "Sem comissões",
        body: "O preço é o do plano. Nada sai do valor de cada venda.",
      },
    ] satisfies FeatureCard[],
  },
} as const;

export const PRICING = {
  eyebrow: "Preços",
  title: "Planos claros, para diferentes necessidades",
  // CORRIGIDO (2): o protótipo dizia "Comece grátis e evolua quando precisar."
  body: "Escolha o plano que precisa e mude quando quiser. Sem comissões sobre a venda, em qualquer plano.",
  audienceTabs: [
    { id: "owner", label: "Para proprietários" },
    { id: "buyer", label: "Para compradores" },
  ],
  billingTabs: [
    { id: "year", label: "Anual" },
    { id: "month", label: "Mensal" },
  ],
} as const;

export const FAQ = {
  title: "Esclareça as suas dúvidas antes de decidir",
  body: "Todos os pedidos enviados através do formulário são respondidos por ordem de chegada. Se preferir, contacte-nos por email: info@upropertymarket.pt",
  items: [
    {
      // CORRIGIDO (4): o protótipo dizia "A plataforma está em beta aberto".
      q: "Quando estará a plataforma disponível?",
      a: "A plataforma está em pré-lançamento. Ao fazer a pré-inscrição agora garante acesso antecipado e os valores de lançamento.",
    },
    {
      // CORRIGIDO (3): a pergunta era "A plataforma é gratuita?" e a resposta
      // dizia que havia plano gratuito. P9-05 acabou com ele.
      q: "Quanto custa usar a plataforma?",
      a: "Todos os planos são pagos e nenhum cobra comissão sobre a venda. Os valores de cada plano estão na secção Preços, com opção anual e mensal.",
    },
    {
      q: "Preciso de ser profissional da área para utilizar?",
      a: "Não. A UProperty Market foi desenhada para ligar diretamente proprietários e compradores, sem intermediários.",
    },
    {
      q: "Posso usar a UProperty Market só no telemóvel?",
      a: "Sim. A plataforma é totalmente responsiva e mais tarde terá aplicação móvel dedicada.",
    },
    {
      q: "O meu contacto fica visível no anúncio?",
      a: "Nunca. Toda a comunicação acontece pelo chat da plataforma até que decida partilhar mais informação.",
    },
    {
      q: "E se encontrar um erro na plataforma?",
      a: "Em qualquer painel tem o botão “Reportar problema”. Descreve o que aconteceu, anexa uma captura e a equipa de IT acompanha o estado consigo.",
    },
  ],
} as const;

export const CONTACT = {
  title: "Tem dúvidas? Fale connosco.",
  body: "Respondemos com a maior brevidade possível, sempre com a atenção que cada questão merece.",
  reasons: [
    { value: "vender", label: "Quero vender um imóvel" },
    { value: "comprar", label: "Quero comprar um imóvel" },
    { value: "planos", label: "Questões sobre planos" },
    { value: "suporte", label: "Suporte técnico" },
  ],
} as const;

/** O rodapé de cinco colunas de 04 §2.1. */
export const FOOTER = {
  tagline: "Compra e venda de imóveis, sem comissões.",
  columns: [
    {
      title: "A plataforma",
      links: [
        { label: "Sobre nós", href: "#sobre" },
        { label: "Como funciona", href: "#plataforma" },
        { label: "Para empresas", href: "#empresas" },
        { label: "Preços", href: "#precos" },
      ],
    },
    {
      title: "Começar",
      links: [
        { label: "Pré-inscrição", href: "/pre-inscricao" },
        { label: "Já tenho conta", href: "/entrar" },
      ],
    },
    {
      title: "Apoio",
      links: [
        { label: "Dúvidas", href: "#duvidas" },
        { label: "Contactos", href: "#contactos" },
      ],
    },
    {
      title: "Termos",
      links: [
        { label: "Termos e condições", href: "/termos" },
        { label: "Política de privacidade", href: "/privacidade" },
        { label: "Política de cookies", href: "/cookies" },
      ],
    },
  ],
  copyright: "© 2026 UProperty Market — Todos os direitos reservados.",
} as const;

/** As âncoras da navbar, na ordem do protótipo. */
export const NAV_ANCHORS = [
  { id: "plataforma", label: "A plataforma" },
  { id: "sobre", label: "Sobre nós" },
  { id: "empresas", label: "Empresas" },
  { id: "precos", label: "Preços" },
  { id: "duvidas", label: "Dúvidas" },
  { id: "contactos", label: "Contactos" },
] as const;
