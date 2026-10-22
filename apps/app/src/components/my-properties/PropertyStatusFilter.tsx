"use client";

import { useTranslations } from "next-intl";
import type { Route } from "next";
import { Select, type SelectOption } from "@upm/ui";
import { useCanvasSafeRouter } from "../../lib/useCanvasSafeRouter";

export type PropertyStatusFilterProps = {
  value: string;
  options: SelectOption[];
};

/** Filtro de estado de "As minhas propriedades" — navega por query param `?estado=`. */
export function PropertyStatusFilter({ value, options }: PropertyStatusFilterProps) {
  // Ver `useCanvasSafeRouter`: no canvas não há router, e o do Next atira.
  const router = useCanvasSafeRouter();
  const t = useTranslations("myProperties");

  return (
    <Select
      label={t("status")}
      labelHidden
      placeholder={t("allStatuses")}
      options={options}
      value={value}
      onChange={(event) => {
        const next = event.target.value;
        router?.push((next ? `/propriedades?estado=${next}` : "/propriedades") as Route);
      }}
    />
  );
}
