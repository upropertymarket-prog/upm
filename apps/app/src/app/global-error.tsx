"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="pt-PT">
      <body>
        <h2>Ocorreu um erro inesperado.</h2>
        <p>A equipa foi notificada. Tente novamente dentro de instantes.</p>
      </body>
    </html>
  );
}
