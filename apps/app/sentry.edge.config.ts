import * as Sentry from "@sentry/nextjs";

import { scrubSentryEvent } from "@upm/config/sentry";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  sendDefaultPii: false,
  // 12 §9.3 — o `sendDefaultPii` trava o que o Sentry apanha sozinho;
  // isto trava o que nós lhe damos. A função é partilhada de propósito.
  beforeSend: scrubSentryEvent,
  tracesSampleRate: 0.1,
});
