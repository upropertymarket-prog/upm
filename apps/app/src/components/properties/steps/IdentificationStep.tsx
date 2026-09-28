"use client";

import { Input, Select, Textarea } from "@upm/ui";
import {
  DEALS,
  PROPERTY_CONDITIONS,
  PROPERTY_TYPES,
  TYPOLOGIES,
  type IdentificationStepInput,
} from "@upm/db/properties";

const DEAL_LABELS: Record<(typeof DEALS)[number], string> = {
  sale: "Venda",
  rent: "Arrendamento",
};

const DEAL_OPTIONS = DEALS.map((deal) => ({ value: deal, label: DEAL_LABELS[deal] }));
const PROPERTY_TYPE_OPTIONS = PROPERTY_TYPES.map((type) => ({ value: type, label: type }));
const TYPOLOGY_OPTIONS = TYPOLOGIES.map((typology) => ({ value: typology, label: typology }));
const CONDITION_OPTIONS = PROPERTY_CONDITIONS.map((condition) => ({
  value: condition,
  label: condition,
}));

export type IdentificationStepProps = {
  value: IdentificationStepInput;
  onChange: (value: IdentificationStepInput) => void;
  errors?: Partial<Record<keyof IdentificationStepInput, string>>;
};

/**
 * Passo 1 do wizard "Nova propriedade" (P4-02) — identificação básica.
 */
export function IdentificationStep({ value, onChange, errors }: IdentificationStepProps) {
  function set<K extends keyof IdentificationStepInput>(key: K, next: IdentificationStepInput[K]) {
    onChange({ ...value, [key]: next });
  }

  return (
    <div className="flex flex-col gap-4" style={{ width: "100%" }}>
      <Input
        label="Título"
        value={value.title}
        onChange={(event) => set("title", event.target.value)}
        error={errors?.title}
        maxLength={160}
      />
      <Select
        label="Tipo de negócio"
        options={DEAL_OPTIONS}
        value={value.deal}
        onChange={(event) => set("deal", event.target.value as IdentificationStepInput["deal"])}
        error={errors?.deal}
      />
      <Select
        label="Tipo de imóvel"
        options={PROPERTY_TYPE_OPTIONS}
        value={value.property_type}
        onChange={(event) =>
          set("property_type", event.target.value as IdentificationStepInput["property_type"])
        }
        error={errors?.property_type}
      />
      <Select
        label="Tipologia"
        options={TYPOLOGY_OPTIONS}
        value={value.typology}
        onChange={(event) =>
          set("typology", event.target.value as IdentificationStepInput["typology"])
        }
        error={errors?.typology}
      />
      <Select
        label="Estado"
        options={CONDITION_OPTIONS}
        value={value.condition}
        onChange={(event) =>
          set("condition", event.target.value as IdentificationStepInput["condition"])
        }
        error={errors?.condition}
      />
      <Textarea
        label="Descrição"
        value={value.description}
        onChange={(event) => set("description", event.target.value)}
        error={errors?.description}
        maxLength={5000}
        rows={6}
      />
    </div>
  );
}
