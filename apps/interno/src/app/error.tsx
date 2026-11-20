"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button, EmptyState } from "@upm/ui";

/**
 * O erro de uma rota do `interno` (12 §12.2)
 * =========================================================================
 * Gémeo do `apps/app/src/app/error.tsx`, e pela mesma razão: o
 * `global-error.tsx` substitui o layout de raiz e serve para quando ele
 * próprio falhou. O caso comum — uma consulta que rebenta a desenhar um ecrã
 * do Admin — merece ficar dentro da área, com o menu de pé.
 *
 * A saída é a raiz do `interno`, que é o encaminhador: lê o papel e manda cada
 * um para a sua área. Mandar para `/admin` seria mandar o Suporte e o
 * Marketing para uma parede.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <div
      style={{ display: "grid", placeItems: "center", minHeight: "60vh", padding: "var(--sp-6)" }}
    >
      <EmptyState
        title={t("unexpectedTitle")}
        description={t("unexpectedBody")}
        action={
          <div
            style={{
              display: "flex",
              gap: "var(--sp-2)",
              flexWrap: "wrap",
              justifyContent: "center",
            }}
          >
            <Button onClick={reset}>{t("retry")}</Button>
            <Button variant="secondary" onClick={() => window.location.assign("/")}>
              {t("backToStart")}
            </Button>
          </div>
        }
      />
      {error.digest ? (
        <p style={{ color: "var(--muted)", fontSize: "var(--fs-body)", marginTop: "var(--sp-3)" }}>
          {error.digest}
        </p>
      ) : null}
    </div>
  );
}
