import * as Sentry from "@sentry/nextjs";

/**
 * Sentry no browser. Conforme doc 07 §4.4 (RGPD):
 * sem PII, sem Session Replay, e breadcrumbs sem conteúdo de mensagens
 * nem documentos — só navegação, cliques e erros (04 §8.7).
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  maxBreadcrumbs: 20,
  beforeBreadcrumb(breadcrumb) {
    // Nunca enviar o conteúdo escrito pelo utilizador.
    if (breadcrumb.category === "console") return null;
    if (breadcrumb.data && "body" in breadcrumb.data) delete breadcrumb.data.body;
    return breadcrumb;
  },
});
