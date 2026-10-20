"use client";

import { useTranslations } from "next-intl";
import { Checkbox, Input } from "@upm/ui";
import type { LocationStepInput } from "@upm/db/properties";

export type LocationStepProps = {
  value: LocationStepInput;
  onChange: (value: LocationStepInput) => void;
  errors?: Partial<Record<keyof LocationStepInput, string>>;
};

/**
 * Passo 3 do wizard "Nova propriedade" (P4-02) — localização.
 * O geocoding acontece no servidor ao gravar (`saveLocationStep`), não aqui.
 */
export function LocationStep({ value, onChange, errors }: LocationStepProps) {
  const t = useTranslations("newProperty");
  const tf = useTranslations("property");

  function set<K extends keyof LocationStepInput>(key: K, next: LocationStepInput[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        label={t("address")}
        value={value.address_line}
        onChange={(event) => set("address_line", event.target.value)}
        error={errors?.address_line}
      />
      <Input
        label={t("postalCode")}
        value={value.postal_code}
        onChange={(event) => set("postal_code", event.target.value)}
        error={errors?.postal_code}
      />
      <Input
        label={tf("fields.city")}
        value={value.city}
        onChange={(event) => set("city", event.target.value)}
        error={errors?.city}
      />
      <Input
        label={t("parish")}
        value={value.parish}
        onChange={(event) => set("parish", event.target.value)}
        error={errors?.parish}
      />
      <Input
        label={t("district")}
        value={value.district}
        onChange={(event) => set("district", event.target.value)}
        error={errors?.district}
      />
      <Checkbox
        label={t("showExact")}
        hint={t("showExactHint")}
        checked={value.show_exact}
        onChange={(event) => set("show_exact", event.target.checked)}
      />
    </div>
  );
}
