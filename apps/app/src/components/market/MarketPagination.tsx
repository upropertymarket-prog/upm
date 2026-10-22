"use client";

import { useTranslations } from "next-intl";
import type { Route } from "next";
import { Pagination } from "@upm/ui";
import { useCanvasSafeRouter } from "../../lib/useCanvasSafeRouter";

/**
 * Wrapper client do `<Pagination>` para o Market — o Server Component pai
 * calcula `page`/`pageCount` e a query atual; aqui só se navega.
 */
export function MarketPagination({
  page,
  pageCount,
  query,
}: {
  page: number;
  pageCount: number;
  /** Query params atuais (sem `pagina`), já como string pronta a anexar. */
  query: string;
}) {
  // Ver `useCanvasSafeRouter`: no canvas não há router, e o do Next atira.
  const router = useCanvasSafeRouter();
  const t = useTranslations("pagination");

  return (
    <Pagination
      page={page}
      pageCount={pageCount}
      labels={{ previous: t("previous"), next: t("next"), page: t("page") }}
      onPageChange={(next) => {
        const params = new URLSearchParams(query);
        params.set("pagina", String(next));
        router?.push(`/market?${params.toString()}` as Route);
      }}
    />
  );
}
