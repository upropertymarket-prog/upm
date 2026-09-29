"use client";

import { Checkbox, Input } from "@upm/ui";
import type { PriceStepInput } from "@upm/db/properties";

export type PriceStepProps = {
  value: PriceStepInput;
  onChange: (value: PriceStepInput) => void;
  errors?: Partial<Record<keyof PriceStepInput, string>>;
};

function centsOrNull(raw: string): number | null {
  if (raw.trim() === "") return null;
  const euros = Number(raw);
  if (!Number.isFinite(euros)) return null;
  return Math.round(euros * 100);
}

function centsToEuros(cents: number | null): number | string {
  return cents === null ? "" : cents / 100;
}

/**
 * Passo 4 do wizard "Nova propriedade" (P4-02) — preço.
 * Os campos mostram euros ao utilizador; o estado interno guarda cêntimos
 * (`price_cents` etc.), tal como a coluna na base de dados.
 */
export function PriceStep({ value, onChange, errors }: PriceStepProps) {
  function set<K extends keyof PriceStepInput>(key: K, next: PriceStepInput[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Input
        label="Preço de venda (€)"
        type="number"
        inputMode="decimal"
        value={centsToEuros(value.price_cents)}
        onChange={(event) => set("price_cents", centsOrNull(event.target.value))}
        error={errors?.price_cents}
      />
      <Input
        label="Renda (€)"
        type="number"
        inputMode="decimal"
        value={centsToEuros(value.rent_cents)}
        onChange={(event) => set("rent_cents", centsOrNull(event.target.value))}
        error={errors?.rent_cents}
      />
      <Input
        label="Condomínio (€)"
        type="number"
        inputMode="decimal"
        value={centsToEuros(value.condo_fee_cents)}
        onChange={(event) => set("condo_fee_cents", centsOrNull(event.target.value))}
        error={errors?.condo_fee_cents}
      />
      <Input
        label="IMI (€)"
        type="number"
        inputMode="decimal"
        value={centsToEuros(value.imi_cents)}
        onChange={(event) => set("imi_cents", centsOrNull(event.target.value))}
        error={errors?.imi_cents}
      />
      <Checkbox
        label="Aceita propostas"
        checked={value.accepts_offers}
        onChange={(event) => set("accepts_offers", event.target.checked)}
      />
    </div>
  );
}
