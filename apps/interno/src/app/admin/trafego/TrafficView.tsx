"use client";

import { useCallback } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { Route } from "next";

import { useCanvasSafeRouter } from "../../../lib/useCanvasSafeRouter";

import {
  TrafficDashboard,
  type TrafficBreakdown,
  type TrafficFilterChange,
  type TrafficPoint,
  type TrafficRange,
  type TrafficScope,
  type TrafficSummary,
} from "./TrafficDashboard";

/**
 * A ligação do ecrã de tráfego ao router — P8-06
 * =========================================================================
 * Só isto conhece o `next/navigation`. O `TrafficDashboard` fica sem nenhuma
 * dependência do Next, o que o torna renderizável no canvas (sidecar Vite) e
 * testável sem montar um router.
 *
 * Os filtros vivem no URL e não em estado: assim um intervalo escolhido pode ser
 * partilhado por ligação e o botão de voltar faz o que se espera.
 */
export function TrafficView(props: {
  locale: string;
  scope: TrafficScope;
  range: TrafficRange;
  summary: TrafficSummary;
  series: TrafficPoint[];
  breakdown: TrafficBreakdown;
}) {
  // Ver `useCanvasSafeRouter`: no canvas não há router, e o do Next atira.
  const router = useCanvasSafeRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onFilterChange = useCallback(
    (next: TrafficFilterChange) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.scope) params.set("scope", next.scope);
      if (next.range) params.set("range", String(next.range));
      router?.push(`${pathname}?${params.toString()}` as Route);
    },
    [router, pathname, searchParams],
  );

  return <TrafficDashboard {...props} onFilterChange={onFilterChange} />;
}
