"use client";

import { useTranslations } from "next-intl";
import { Input } from "@upm/ui";
import type { CharacteristicsStepInput } from "@upm/db/properties";

export type CharacteristicsStepProps = {
  value: CharacteristicsStepInput;
  onChange: (value: CharacteristicsStepInput) => void;
  errors?: Partial<Record<keyof CharacteristicsStepInput, string>>;
};

function numberOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Passo 2 do wizard "Nova propriedade" (P4-02) — características.
 * Todos os campos numéricos são nullable: campo vazio grava `null`, não `0`.
 */
export function CharacteristicsStep({ value, onChange, errors }: CharacteristicsStepProps) {
  const t = useTranslations("newProperty");
  const tf = useTranslations("property");

  function set<K extends keyof CharacteristicsStepInput>(
    key: K,
    next: CharacteristicsStepInput[K],
  ) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Input
        label={t("grossArea")}
        type="number"
        inputMode="decimal"
        value={value.gross_area ?? ""}
        onChange={(event) => set("gross_area", numberOrNull(event.target.value))}
        error={errors?.gross_area}
      />
      <Input
        label={t("netArea")}
        type="number"
        inputMode="decimal"
        value={value.net_area ?? ""}
        onChange={(event) => set("net_area", numberOrNull(event.target.value))}
        error={errors?.net_area}
      />
      <Input
        label={t("bedrooms")}
        type="number"
        inputMode="numeric"
        value={value.bedrooms ?? ""}
        onChange={(event) => set("bedrooms", numberOrNull(event.target.value))}
        error={errors?.bedrooms}
      />
      <Input
        label={tf("fields.bathrooms")}
        type="number"
        inputMode="numeric"
        value={value.bathrooms ?? ""}
        onChange={(event) => set("bathrooms", numberOrNull(event.target.value))}
        error={errors?.bathrooms}
      />
      <Input
        label={tf("fields.floor")}
        value={value.floor ?? ""}
        onChange={(event) => set("floor", event.target.value || null)}
        error={errors?.floor}
      />
      <Input
        label={tf("fields.yearBuilt")}
        type="number"
        inputMode="numeric"
        value={value.year_built ?? ""}
        onChange={(event) => set("year_built", numberOrNull(event.target.value))}
        error={errors?.year_built}
      />
      <Input
        label={tf("fields.energyCert")}
        value={value.energy_cert ?? ""}
        onChange={(event) => set("energy_cert", event.target.value || null)}
        error={errors?.energy_cert}
        maxLength={10}
      />
      <Input
        label={t("amenities")}
        value={value.amenities.join(", ")}
        onChange={(event) =>
          set(
            "amenities",
            event.target.value
              .split(",")
              .map((item) => item.trim())
              .filter(Boolean),
          )
        }
        error={errors?.amenities}
      />
    </div>
  );
}
