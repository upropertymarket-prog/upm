// GERADO POR scripts/generate-seo-routes.mjs — NÃO EDITAR À MÃO.
// Corra `pnpm seo:routes` depois de criar ou alterar um `seo.ts`.
//
// O inventário das rotas públicas do `apps/web`, com os valores por omissão
// que vivem no ficheiro de cada uma. `/admin/seo` cruza isto com `seo_pages`
// para saber que páginas existem e quais foram personalizadas — ver 04 §2.1.1.

/** Os textos versionados de uma rota, num idioma. */
export type SeoRouteText = {
  /** Nome legível, para a lista do Admin. */
  pageName: string;
  /** O valor versionado, mostrado como "predefinição" no editor. */
  titleTag: string;
  metaDescription: string;
};

export type SeoRoute = {
  /** O caminho da página: "/", "/termos", … A mesma chave nos dois idiomas. */
  route: string;
  /**
   * Os textos por idioma. Era um conjunto único até 21 out 2026, e nessa forma
   * dava sempre o português: o painel mostrava a predefinição portuguesa como
   * predefinição de qualquer idioma.
   */
  text: Record<"pt" | "en", SeoRouteText>;
  /**
   * O URL público em cada idioma, prefixo incluído: `/termos` e `/en/terms`.
   * Lido de `apps/web/src/i18n/pathnames.ts` — o Admin não pode importá-lo.
   */
  path: Record<"pt" | "en", string>;
  /** Rotas com segmento `[slug]`: o registo é um template. */
  dynamic: boolean;
  /** `noindex: true` no `seo.ts`. O sitemap exclui estas rotas. */
  noindex: boolean;
};

export const SEO_ROUTES: readonly SeoRoute[] = [
  {
    route: "/",
    text: {
      pt: {
        pageName: "Início",
        titleTag: "UProperty Market · Propriedades sem comissões",
        metaDescription:
          "Compradores e proprietários falam diretamente, no seu ritmo, com informação transparente e controlo total do processo. Sem intermediários e sem comissões.",
      },
      en: {
        pageName: "Home",
        titleTag: "UProperty Market · Property with no commission",
        metaDescription:
          "Buyers and owners talk directly, at their own pace, with transparent information and full control of the process. No middlemen and no commission.",
      },
    },
    path: {
      pt: "/",
      en: "/en",
    },
    dynamic: false,
    noindex: false,
  },
  {
    route: "/cancelar-subscricao",
    text: {
      pt: {
        pageName: "Cancelar subscrição",
        titleTag: "Cancelar subscrição · UProperty Market",
        metaDescription: "Deixe de receber as comunicações de marketing da UProperty Market.",
      },
      en: {
        pageName: "Unsubscribe",
        titleTag: "Unsubscribe · UProperty Market",
        metaDescription: "Stop receiving marketing communications from UProperty Market.",
      },
    },
    path: {
      pt: "/cancelar-subscricao",
      en: "/en/cancel-subscription",
    },
    dynamic: false,
    noindex: true,
  },
  {
    route: "/cookies",
    text: {
      pt: {
        pageName: "Política de Cookies",
        titleTag: "Política de Cookies · UProperty Market",
        metaDescription:
          "Que cookies e tecnologias semelhantes a UProperty Market utiliza, e como pode controlá-los.",
      },
      en: {
        pageName: "Cookie Policy",
        titleTag: "Cookie Policy · UProperty Market",
        metaDescription:
          "Which cookies and similar technologies UProperty Market uses, and how you can control them.",
      },
    },
    path: {
      pt: "/cookies",
      en: "/en/cookies",
    },
    dynamic: false,
    noindex: false,
  },
  {
    route: "/criar-conta",
    text: {
      pt: {
        pageName: "Criar conta",
        titleTag: "Criar conta · UProperty Market",
        metaDescription:
          "Crie a sua conta na UProperty Market e comece a comprar, vender ou arrendar sem comissões sobre a venda.",
      },
      en: {
        pageName: "Create account",
        titleTag: "Create account · UProperty Market",
        metaDescription:
          "Create your UProperty Market account and start buying, selling or renting with no commission on the sale.",
      },
    },
    path: {
      pt: "/criar-conta",
      en: "/en/sign-up",
    },
    dynamic: false,
    noindex: false,
  },
  {
    route: "/criar-conta/verificacao",
    text: {
      pt: {
        pageName: "Verificar e-mail",
        titleTag: "Verificar o e-mail · UProperty Market",
        metaDescription: "Confirme o seu endereço de e-mail para ativar a conta.",
      },
      en: {
        pageName: "Verify email",
        titleTag: "Verify your email · UProperty Market",
        metaDescription: "Confirm your email address to activate the account.",
      },
    },
    path: {
      pt: "/criar-conta/verificacao",
      en: "/en/sign-up/verify",
    },
    dynamic: false,
    noindex: true,
  },
  {
    route: "/entrar",
    text: {
      pt: {
        pageName: "Entrar",
        titleTag: "Entrar · UProperty Market",
        metaDescription: "Acesso à sua conta UProperty Market.",
      },
      en: {
        pageName: "Sign in",
        titleTag: "Sign in · UProperty Market",
        metaDescription: "Access your UProperty Market account.",
      },
    },
    path: {
      pt: "/entrar",
      en: "/en/sign-in",
    },
    dynamic: false,
    noindex: true,
  },
  {
    route: "/pre-inscricao",
    text: {
      pt: {
        pageName: "Pré-inscrição",
        titleTag: "Pré-inscrição · UProperty Market",
        metaDescription:
          "Inscreva-se para ser avisado quando as primeiras propriedades abrirem, e garanta os valores de lançamento. Sem comissões sobre a venda.",
      },
      en: {
        pageName: "Pre-registration",
        titleTag: "Pre-registration · UProperty Market",
        metaDescription:
          "Sign up to hear when the first properties open, and secure the launch prices. No commission on the sale.",
      },
    },
    path: {
      pt: "/pre-inscricao",
      en: "/en/early-access",
    },
    dynamic: false,
    noindex: false,
  },
  {
    route: "/pre-inscricao/confirmar",
    text: {
      pt: {
        pageName: "Confirmar a pré-inscrição",
        titleTag: "Confirmar a pré-inscrição · UProperty Market",
        metaDescription: "Confirme o seu endereço de e-mail para completar a pré-inscrição.",
      },
      en: {
        pageName: "Confirm your early access",
        titleTag: "Confirm your early access · UProperty Market",
        metaDescription: "Confirm your email address to complete your early-access sign-up.",
      },
    },
    path: {
      pt: "/pre-inscricao/confirmar",
      en: "/en/early-access/confirm",
    },
    dynamic: false,
    noindex: true,
  },
  {
    route: "/pre-inscricao/remover",
    text: {
      pt: {
        pageName: "Remover a pré-inscrição",
        titleTag: "Remover a pré-inscrição · UProperty Market",
        metaDescription: "Apague a sua pré-inscrição e os dados que deixou.",
      },
      en: {
        pageName: "Remove your early access",
        titleTag: "Remove your early access · UProperty Market",
        metaDescription: "Delete your early-access sign-up and the details you left.",
      },
    },
    path: {
      pt: "/pre-inscricao/remover",
      en: "/en/early-access/remove",
    },
    dynamic: false,
    noindex: true,
  },
  {
    route: "/privacidade",
    text: {
      pt: {
        pageName: "Política de Privacidade",
        titleTag: "Política de Privacidade · UProperty Market",
        metaDescription:
          "Como a UProperty Market trata os seus dados pessoais: finalidades, bases legais, prazos de conservação e os seus direitos.",
      },
      en: {
        pageName: "Privacy Policy",
        titleTag: "Privacy Policy · UProperty Market",
        metaDescription:
          "How UProperty Market handles your personal data: purposes, legal bases, retention periods and your rights.",
      },
    },
    path: {
      pt: "/privacidade",
      en: "/en/privacy",
    },
    dynamic: false,
    noindex: false,
  },
  {
    route: "/propriedades",
    text: {
      pt: {
        pageName: "Propriedades",
        titleTag: "Propriedades sem comissões · UProperty Market",
        metaDescription:
          "Casas e apartamentos para comprar e arrendar, falando diretamente com quem vende. Sem comissões, sem intermediários e sem contactos indesejados.",
      },
      en: {
        pageName: "Properties",
        titleTag: "Property with no commission · UProperty Market",
        metaDescription:
          "Houses and flats to buy and to rent, talking directly to the seller. No commission, no middlemen and no unwanted calls.",
      },
    },
    path: {
      pt: "/propriedades",
      en: "/en/properties",
    },
    dynamic: false,
    noindex: false,
  },
  {
    route: "/propriedades/[slug]",
    text: {
      pt: {
        pageName: "Propriedade (detalhe)",
        titleTag: "{titulo} · {tipologia} em {localidade} · UProperty Market",
        metaDescription:
          "{titulo} — {tipologia} em {localidade} por {preco}. Fale diretamente com o proprietário, sem comissões nem intermediários.",
      },
      en: {
        pageName: "Property (detail)",
        titleTag: "{titulo} · {tipologia} in {localidade} · UProperty Market",
        metaDescription:
          "{titulo} — {tipologia} in {localidade} for {preco}. Talk directly to the owner, with no commission and no middlemen.",
      },
    },
    path: {
      pt: "/propriedades/[slug]",
      en: "/en/properties/[slug]",
    },
    dynamic: true,
    noindex: false,
  },
  {
    route: "/recuperar-palavra-passe",
    text: {
      pt: {
        pageName: "Recuperar palavra-passe",
        titleTag: "Recuperar palavra-passe · UProperty Market",
        metaDescription: "Recupere o acesso à sua conta UProperty Market.",
      },
      en: {
        pageName: "Reset password",
        titleTag: "Reset your password · UProperty Market",
        metaDescription: "Get back into your UProperty Market account.",
      },
    },
    path: {
      pt: "/recuperar-palavra-passe",
      en: "/en/reset-password",
    },
    dynamic: false,
    noindex: true,
  },
  {
    route: "/recuperar-palavra-passe/confirmar",
    text: {
      pt: {
        pageName: "Definir nova palavra-passe",
        titleTag: "Nova palavra-passe · UProperty Market",
        metaDescription: "Defina uma nova palavra-passe para a sua conta.",
      },
      en: {
        pageName: "Set a new password",
        titleTag: "New password · UProperty Market",
        metaDescription: "Set a new password for your account.",
      },
    },
    path: {
      pt: "/recuperar-palavra-passe/confirmar",
      en: "/en/reset-password/confirm",
    },
    dynamic: false,
    noindex: true,
  },
  {
    route: "/termos",
    text: {
      pt: {
        pageName: "Termos e Condições",
        titleTag: "Termos e Condições · UProperty Market",
        metaDescription:
          "Os Termos e Condições de utilização da plataforma UProperty Market, com versão e data de entrada em vigor.",
      },
      en: {
        pageName: "Terms and Conditions",
        titleTag: "Terms and Conditions · UProperty Market",
        metaDescription:
          "The Terms and Conditions for using the UProperty Market platform, with their version and effective date.",
      },
    },
    path: {
      pt: "/termos",
      en: "/en/terms",
    },
    dynamic: false,
    noindex: false,
  },
] as const;
