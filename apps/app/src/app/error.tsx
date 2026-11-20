"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button, EmptyState } from "@upm/ui";

/**
 * O erro de uma rota — e a diferença para o `global-error.tsx` (12 §12.2)
 * =========================================================================
 * Até 29 out 2026 esta app só tinha `global-error.tsx`. É o último recurso:
 * substitui o layout de raiz, renderiza o seu próprio `<html>` e por isso
 * **perde a navegação, o tema e o idioma** — tem de os resolver à mão. Serve
 * para quando o próprio layout falhou, que é raro.
 *
 * O caso comum é outro: uma consulta que falha ao desenhar uma página, com o
 * resto da app de pé. Sem este ficheiro, esse caso caía no `global-error` e a
 * pessoa via um ecrã nu, sem menu, sem saber onde estava — como se a app
 * inteira tivesse desaparecido por causa de uma página.
 *
 * Aqui o layout mantém-se, logo há `useTranslations` (o provider está vivo), e
 * há duas saídas: tentar outra vez, que resolve o erro intermitente, e voltar
 * ao início, que resolve o resto.
 *
 * **O `digest` é mostrado de propósito.** É o identificador que o Next gera e
 * que o Sentry regista; o detalhe do erro não aparece — isso seria dar o mapa
 * (08 §3.6) —, mas sem nenhuma referência, quem contacta o Suporte diz "deu
 * erro" e ninguém consegue ligar isso ao relatório.
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
