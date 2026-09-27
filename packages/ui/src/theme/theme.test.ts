import { describe, expect, it } from "vitest";

import { THEME_CHOICES, isThemeChoice } from "./theme";
import { greetingKey } from "../shell/PageHeader";

describe("tema (04 §5.2)", () => {
  it("tem exatamente as três opções Claro / Escuro / Sistema", () => {
    expect(THEME_CHOICES).toEqual(["light", "dark", "system"]);
  });

  it("rejeita valores que não sejam escolhas de tema", () => {
    // `profiles.theme` tem o mesmo `check` na migração; o valor chega do
    // servidor e não se confia nele sem validar.
    expect(isThemeChoice("dark")).toBe(true);
    expect(isThemeChoice("system")).toBe(true);
    expect(isThemeChoice("DARK")).toBe(false);
    expect(isThemeChoice("")).toBe(false);
    expect(isThemeChoice(null)).toBe(false);
    expect(isThemeChoice(undefined)).toBe(false);
  });
});

describe("saudação do Painel (04 §5.5)", () => {
  const at = (hour: number) => new Date(2026, 8, 26, hour, 0, 0);

  it("corta às 13 h e às 20 h, como nos protótipos", () => {
    expect(greetingKey(at(0))).toBe("morning");
    expect(greetingKey(at(12))).toBe("morning");
    expect(greetingKey(at(13))).toBe("afternoon");
    expect(greetingKey(at(19))).toBe("afternoon");
    expect(greetingKey(at(20))).toBe("evening");
    expect(greetingKey(at(23))).toBe("evening");
  });
});
