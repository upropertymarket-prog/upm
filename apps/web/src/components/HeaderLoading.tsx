"use client";

import { useLocale } from "next-intl";
import { Brand, Skeleton } from "@upm/ui";

import { PublicHeader, recallLaunchMode } from "./PublicHeader";

/**
 * A barra do site enquanto a página seguinte carrega: a verdadeira, com o modo
 * que a página anterior mostrou; na primeira carga, uma barra sem texto com as
 * mesmas medidas (o modo vem da base, e o esqueleto não espera por ela).
 */
export function HeaderLoading() {
  const locale = useLocale();
  const launchMode = recallLaunchMode();

  if (launchMode) return <PublicHeader locale={locale} launchMode={launchMode} />;

  return (
    <header className="upm-topbar" aria-hidden="true">
      <div className="upm-topbar__inner" style={{ columnGap: "48px" }}>
        <Brand />
        <div
          style={{
            display: "flex",
            gap: "var(--sp-6)",
            flex: 1,
            justifyContent: "center",
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} width={64} height={12} />
          ))}
        </div>
        <Skeleton width={132} height="var(--h-md)" radius="var(--r-lg)" />
      </div>
    </header>
  );
}
