"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import type { Route } from "next";
import { Button, Input, Select } from "@upm/ui";
import { DEALS, PROPERTY_TYPES, TYPOLOGIES } from "@upm/db/properties";

export type PropertyFiltersValue = {
  deal?: string;
  property_type?: string;
  typology?: string;
  price_min_cents?: string;
  price_max_cents?: string;
  city?: string;
};

/**
 * Campos de filtro partilhados pelo Market (P4-04a) e pelos Alertas (P4-04b)
 * — o mesmo shape de `propertyFiltersSchema` (`@upm/db/properties`).
 *
 * `basePath` decide para onde o formulário navega: `/market` no Market,
 * omitido nos Alertas (que tratam o `onSubmit` de outra forma, via prop).
 */
export function PropertyFilters({
  basePath = "/market",
  initial,
  onApply,
}: {
  basePath?: string;
  initial?: PropertyFiltersValue;
  /** Alternativa ao `router.push`, para reutilizar os campos fora do Market (Alertas). */
  onApply?: (value: PropertyFiltersValue) => void;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations("market.filters");
  // As etiquetas de negócio nascem aqui e não numa constante de módulo: uma
  // constante fica presa ao idioma em que foi escrita.
  const tf = useTranslations("property");
  const [deal, setDeal] = useState(initial?.deal ?? searchParams?.get("negocio") ?? "");
  const [propertyType, setPropertyType] = useState(
    initial?.property_type ?? searchParams?.get("tipo") ?? "",
  );
  const [typology, setTypology] = useState(
    initial?.typology ?? searchParams?.get("tipologia") ?? "",
  );
  const centsToEuro = (cents?: string | null): string => {
    if (!cents) return "";
    const parsed = Number.parseInt(cents, 10);
    return Number.isNaN(parsed) ? "" : String(parsed / 100);
  };
  const [priceMin, setPriceMin] = useState(
    centsToEuro(initial?.price_min_cents ?? searchParams?.get("preco_min")),
  );
  const [priceMax, setPriceMax] = useState(
    centsToEuro(initial?.price_max_cents ?? searchParams?.get("preco_max")),
  );
  const [city, setCity] = useState(initial?.city ?? searchParams?.get("cidade") ?? "");

  const euroToCents = (euros: string): string | undefined => {
    const parsed = Number.parseFloat(euros);
    if (!euros || Number.isNaN(parsed)) return undefined;
    return String(Math.round(parsed * 100));
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value: PropertyFiltersValue = {
      deal: deal || undefined,
      property_type: propertyType || undefined,
      typology: typology || undefined,
      price_min_cents: euroToCents(priceMin),
      price_max_cents: euroToCents(priceMax),
      city: city || undefined,
    };

    if (onApply) {
      onApply(value);
      return;
    }

    const params = new URLSearchParams();
    if (value.deal) params.set("negocio", value.deal);
    if (value.property_type) params.set("tipo", value.property_type);
    if (value.typology) params.set("tipologia", value.typology);
    if (value.price_min_cents) params.set("preco_min", value.price_min_cents);
    if (value.price_max_cents) params.set("preco_max", value.price_max_cents);
    if (value.city) params.set("cidade", value.city);
    const query = params.toString();
    router.push((query ? `${basePath}?${query}` : basePath) as Route);
  };

  return (
    <form
      onSubmit={submit}
      style={{
        display: "grid",
        gap: 12,
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 140px), 1fr))",
      }}
    >
      <Select
        label={tf("fields.deal")}
        placeholder={t("any")}
        value={deal}
        onChange={(event) => setDeal(event.target.value)}
        options={DEALS.map((value) => ({ value, label: tf(`deal.${value}`) }))}
      />
      <Select
        label={tf("fields.type")}
        placeholder={t("any")}
        value={propertyType}
        onChange={(event) => setPropertyType(event.target.value)}
        options={PROPERTY_TYPES.map((value) => ({ value, label: value }))}
      />
      <Select
        label={tf("fields.typology")}
        placeholder={t("anyTypology")}
        value={typology}
        onChange={(event) => setTypology(event.target.value)}
        options={TYPOLOGIES.map((value) => ({ value, label: value }))}
      />
      <Input
        label={t("priceMin")}
        type="number"
        min={0}
        value={priceMin}
        onChange={(event) => setPriceMin(event.target.value)}
      />
      <Input
        label={t("priceMax")}
        type="number"
        min={0}
        value={priceMax}
        onChange={(event) => setPriceMax(event.target.value)}
      />
      <Input
        label={tf("fields.city")}
        value={city}
        onChange={(event) => setCity(event.target.value)}
      />
      <div style={{ alignSelf: "end" }}>
        <Button type="submit" fullWidth>
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}
