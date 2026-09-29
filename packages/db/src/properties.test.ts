import { describe, expect, it } from "vitest";

import {
  characteristicsStepSchema,
  identificationStepSchema,
  locationStepSchema,
  priceStepSchema,
  propertyConditionSchema,
  propertyFiltersSchema,
  propertyTypeSchema,
} from "./properties";

describe("propertyTypeSchema / propertyConditionSchema (07 §17.2)", () => {
  it("aceita só a lista fechada de tipos", () => {
    expect(propertyTypeSchema.safeParse("Apartamento").success).toBe(true);
    expect(propertyTypeSchema.safeParse("Trespasse").success).toBe(false);
    expect(propertyTypeSchema.safeParse("apartamento").success).toBe(false);
  });

  it("aceita só a lista fechada de estados", () => {
    expect(propertyConditionSchema.safeParse("Usado — bom estado").success).toBe(true);
    expect(propertyConditionSchema.safeParse("Bom estado").success).toBe(false);
  });
});

describe("identificationStepSchema", () => {
  const valid = {
    title: "Apartamento T3 com varanda",
    deal: "sale",
    property_type: "Apartamento",
    typology: "T3",
    condition: "Remodelado",
    description: "Descrição do imóvel.",
  };

  it("aceita um input válido", () => {
    expect(identificationStepSchema.safeParse(valid).success).toBe(true);
  });

  it("rejeita título vazio", () => {
    expect(identificationStepSchema.safeParse({ ...valid, title: "" }).success).toBe(false);
  });

  it("rejeita tipo de negócio fora do enum (Trespasse)", () => {
    expect(identificationStepSchema.safeParse({ ...valid, deal: "lease_transfer" }).success).toBe(
      false,
    );
  });
});

describe("characteristicsStepSchema", () => {
  it("aceita nulls para campos opcionais", () => {
    const result = characteristicsStepSchema.safeParse({
      gross_area: null,
      net_area: null,
      bedrooms: null,
      bathrooms: null,
      floor: null,
      year_built: null,
      energy_cert: null,
      amenities: [],
    });
    expect(result.success).toBe(true);
  });

  it("rejeita ano de construção implausível", () => {
    const result = characteristicsStepSchema.safeParse({
      gross_area: 90,
      net_area: 80,
      bedrooms: 2,
      bathrooms: 1,
      floor: "3",
      year_built: 1500,
      energy_cert: "A",
      amenities: [],
    });
    expect(result.success).toBe(false);
  });
});

describe("locationStepSchema", () => {
  it("exige morada e cidade", () => {
    expect(
      locationStepSchema.safeParse({
        address_line: "",
        postal_code: "1000-000",
        city: "Lisboa",
        parish: "",
        district: "",
        show_exact: false,
      }).success,
    ).toBe(false);
  });
});

describe("priceStepSchema", () => {
  it("exige pelo menos um preço (venda ou arrendamento)", () => {
    const result = priceStepSchema.safeParse({
      price_cents: null,
      rent_cents: null,
      condo_fee_cents: null,
      imi_cents: null,
      accepts_offers: false,
    });
    expect(result.success).toBe(false);
  });

  it("aceita só preço de venda", () => {
    const result = priceStepSchema.safeParse({
      price_cents: 25_000_000,
      rent_cents: null,
      condo_fee_cents: null,
      imi_cents: null,
      accepts_offers: true,
    });
    expect(result.success).toBe(true);
  });
});

describe("propertyFiltersSchema", () => {
  it("todos os campos são opcionais", () => {
    expect(propertyFiltersSchema.safeParse({}).success).toBe(true);
  });
});
