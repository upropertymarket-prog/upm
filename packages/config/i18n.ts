/**
 * i18n — contrato partilhado (P1-06)
 * =========================================================================
 * 02 §12 e 07 §5.13: `next-intl`, **PT-PT é a fonte de verdade**, EN entra na
 * v1 cobrindo as três apps, e-mails, campanhas e textos legais. As mensagens
 * vivem em `packages/config/messages/{pt,en}.json`.
 *
 * Decisão de encaminhamento: **sem prefixo de locale no URL.** As rotas do
 * produto são em português e estão inventariadas em 03 §1 (`/painel`,
 * `/market`, `/meus-pedidos`, …); pôr `/pt` e `/en` à frente de todas duplicava
 * o inventário, mexia no `check-seo` e nos canonicals de 04 §8.1, e obrigava a
 * redirects em todas as ligações já escritas na doc. O idioma passa a ser
 * preferência do utilizador, num cookie, como o tema.
 *
 * Consequência aceite: o site público não serve versões indexáveis separadas
 * por idioma. Não há requisito de SEO multilingue em 04 §8.1 — o `og:locale` é
 * `pt_PT` — e, se aparecer, resolve-se com `/en` só em `apps/web`, sem tocar na
 * app autenticada.
 */

export const LOCALES = ["pt", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** PT-PT é a fonte de verdade (07 §5.13). */
export const DEFAULT_LOCALE: Locale = "pt";

/** Cookie de idioma. Estritamente necessário, isento de consentimento (07 §4.4). */
export const LOCALE_COOKIE = "upm-locale";

/** Etiquetas `Intl` para datas e moeda (02 §12). */
export const INTL_LOCALE: Record<Locale, string> = {
  pt: "pt-PT",
  en: "en-GB",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Normaliza o que vier do cookie ou do `Accept-Language`. */
export function resolveLocale(value: unknown): Locale {
  if (isLocale(value)) return value;
  if (typeof value === "string") {
    const base = value.split("-")[0]?.toLowerCase();
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}
