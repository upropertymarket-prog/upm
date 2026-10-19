"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@upm/config";
import en from "@upm/config/messages/en.json";
import pt from "@upm/config/messages/pt.json";

/**
 * O erro que apanha tudo — e o único sítio onde o idioma se resolve à mão
 * =========================================================================
 * `global-error.tsx` **substitui o layout de raiz**: renderiza o seu próprio
 * `<html>` e corre precisamente quando esse layout falhou. O
 * `NextIntlClientProvider` vive lá — chamar `useTranslations()` aqui atirava
 * dentro do limite de erro, e um erro tratado passava a erro não tratado, que
 * é o pior resultado possível neste ficheiro.
 *
 * Por isso o idioma lê-se do cookie e as mensagens vêm dos ficheiros
 * importados diretamente. **Não são strings escritas à mão**: são as mesmas
 * chaves de `messages/*.json` que o resto do produto usa, só alcançadas por
 * outro caminho. É a diferença entre uma exceção com razão e um descuido.
 *
 * O `useState` com leitura no `useEffect` existe por causa da hidratação: o
 * servidor não tem `document.cookie`, e decidir o idioma na primeira
 * renderização dava marcação diferente nos dois lados. Começa na língua-fonte
 * e corrige-se no cliente, que num ecrã de erro é imperceptível.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  const [locale, setLocale] = useState<string>(DEFAULT_LOCALE);

  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  useEffect(() => {
    const bruto = document.cookie
      .split("; ")
      .find((parte) => parte.startsWith(`${LOCALE_COOKIE}=`))
      ?.split("=")[1];
    if (bruto && isLocale(bruto)) setLocale(bruto);
  }, []);

  const mensagens = locale === "en" ? en : pt;

  return (
    <html lang={locale === "en" ? "en" : "pt-PT"}>
      <body>
        <h2>{mensagens.errors.unexpectedTitle}</h2>
        <p>{mensagens.errors.unexpectedBody}</p>
      </body>
    </html>
  );
}
