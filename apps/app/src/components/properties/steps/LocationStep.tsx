"use client";

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
  function set<K extends keyof LocationStepInput>(key: K, next: LocationStepInput[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="flex flex-col gap-4">
      <Input
        label="Morada"
        value={value.address_line}
        onChange={(event) => set("address_line", event.target.value)}
        error={errors?.address_line}
      />
      <Input
        label="Código postal"
        value={value.postal_code}
        onChange={(event) => set("postal_code", event.target.value)}
        error={errors?.postal_code}
      />
      <Input
        label="Cidade"
        value={value.city}
        onChange={(event) => set("city", event.target.value)}
        error={errors?.city}
      />
      <Input
        label="Freguesia"
        value={value.parish}
        onChange={(event) => set("parish", event.target.value)}
        error={errors?.parish}
      />
      <Input
        label="Distrito"
        value={value.district}
        onChange={(event) => set("district", event.target.value)}
        error={errors?.district}
      />
      <Checkbox
        label="Mostrar localização exata no anúncio"
        hint="Sem isto, o Mapa mostra só uma zona aproximada até haver uma visita marcada."
        checked={value.show_exact}
        onChange={(event) => set("show_exact", event.target.checked)}
      />
    </div>
  );
}
