// GERADO POR scripts/generate-seo-routes.mjs — NÃO EDITAR À MÃO.
// Corra `pnpm seo:routes` depois de criar ou alterar um `seo.ts`.
//
// O inventário das rotas públicas do `apps/web`, com os valores por omissão
// que vivem no ficheiro de cada uma. `/admin/seo` cruza isto com `seo_pages`
// para saber que páginas existem e quais foram personalizadas — ver 04 §2.1.1.

export type SeoRoute = {
  /** O caminho da página: "/", "/termos", … */
  route: string;
  /** Nome legível, para a lista do Admin. */
  pageName: string;
  /** O valor versionado, mostrado como "predefinição" no editor. */
  titleTag: string;
  metaDescription: string;
  /** Rotas com segmento `[slug]`: o registo é um template. */
  dynamic: boolean;
  /** `noindex: true` no `seo.ts`. O sitemap exclui estas rotas. */
  noindex: boolean;
};

export const SEO_ROUTES: readonly SeoRoute[] = [
  {
    route: "/",
    pageName: "Início",
    titleTag: "UProperty Market · Propriedades sem comissões",
    metaDescription:
      "Compradores e proprietários falam diretamente, no seu ritmo, com informação transparente e controlo total do processo. Sem intermediários e sem comissões.",
    dynamic: false,
    noindex: false,
  },
  {
    route: "/cookies",
    pageName: "Política de Cookies",
    titleTag: "Política de Cookies · UProperty Market",
    metaDescription:
      "Que cookies e tecnologias semelhantes a UProperty Market utiliza, e como pode controlá-los.",
    dynamic: false,
    noindex: false,
  },
  {
    route: "/criar-conta",
    pageName: "Criar conta",
    titleTag: "Criar conta · UProperty Market",
    metaDescription:
      "Crie a sua conta na UProperty Market e comece a comprar, vender ou arrendar sem comissões sobre a venda.",
    dynamic: false,
    noindex: false,
  },
  {
    route: "/criar-conta/verificacao",
    pageName: "Verificar e-mail",
    titleTag: "Verificar o e-mail · UProperty Market",
    metaDescription: "Confirme o seu endereço de e-mail para ativar a conta.",
    dynamic: false,
    noindex: true,
  },
  {
    route: "/entrar",
    pageName: "Entrar",
    titleTag: "Entrar · UProperty Market",
    metaDescription: "Acesso à sua conta UProperty Market.",
    dynamic: false,
    noindex: true,
  },
  {
    route: "/imoveis",
    pageName: "Propriedades",
    titleTag: "Propriedades sem comissões · UProperty Market",
    metaDescription:
      "Casas e apartamentos para comprar e arrendar, falando diretamente com quem vende. Sem comissões, sem intermediários e sem contactos indesejados.",
    dynamic: false,
    noindex: false,
  },
  {
    route: "/imoveis/[slug]",
    pageName: "Propriedade (detalhe)",
    titleTag: "{titulo} · {tipologia} em {localidade} · UProperty Market",
    metaDescription:
      "{titulo} — {tipologia} em {localidade} por {preco}. Fale diretamente com o proprietário, sem comissões nem intermediários.",
    dynamic: true,
    noindex: false,
  },
  {
    route: "/pre-inscricao",
    pageName: "Pré-inscrição",
    titleTag: "Pré-inscrição · UProperty Market",
    metaDescription:
      "Inscreva-se para ser avisado quando as primeiras propriedades abrirem, e garanta os valores de lançamento. Sem comissões sobre a venda.",
    dynamic: false,
    noindex: false,
  },
  {
    route: "/privacidade",
    pageName: "Política de Privacidade",
    titleTag: "Política de Privacidade · UProperty Market",
    metaDescription:
      "Como a UProperty Market trata os seus dados pessoais: finalidades, bases legais, prazos de conservação e os seus direitos.",
    dynamic: false,
    noindex: false,
  },
  {
    route: "/recuperar-palavra-passe",
    pageName: "Recuperar palavra-passe",
    titleTag: "Recuperar palavra-passe · UProperty Market",
    metaDescription: "Recupere o acesso à sua conta UProperty Market.",
    dynamic: false,
    noindex: true,
  },
  {
    route: "/recuperar-palavra-passe/confirmar",
    pageName: "Definir nova palavra-passe",
    titleTag: "Nova palavra-passe · UProperty Market",
    metaDescription: "Defina uma nova palavra-passe para a sua conta.",
    dynamic: false,
    noindex: true,
  },
  {
    route: "/termos",
    pageName: "Termos e Condições",
    titleTag: "Termos e Condições · UProperty Market",
    metaDescription:
      "Os Termos e Condições de utilização da plataforma UProperty Market, com versão e data de entrada em vigor.",
    dynamic: false,
    noindex: false,
  },
] as const;
