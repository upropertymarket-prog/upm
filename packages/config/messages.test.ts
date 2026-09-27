import { describe, expect, it } from "vitest";

import en from "./messages/en.json";
import pt from "./messages/pt.json";
import { DEFAULT_LOCALE, LOCALES, resolveLocale } from "./i18n";

type Messages = Record<string, unknown>;

/** Aplana `{a:{b:"x"}}` em `["a.b"]`, para comparar estruturas. */
function keys(messages: Messages, prefix = ""): string[] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object" ? keys(value as Messages, path) : [path];
  });
}

/** `{name}` → `name`. Placeholders têm de existir nas duas línguas. */
function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();
}

function entries(messages: Messages, prefix = ""): [string, string][] {
  return Object.entries(messages).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return value !== null && typeof value === "object"
      ? entries(value as Messages, path)
      : ([[path, String(value)]] as [string, string][]);
  });
}

describe("i18n (02 §12 · 07 §5.13)", () => {
  it("tem PT e EN, com PT-PT como fonte", () => {
    expect(LOCALES).toEqual(["pt", "en"]);
    expect(DEFAULT_LOCALE).toBe("pt");
  });

  it("aceita a etiqueta base de um Accept-Language", () => {
    expect(resolveLocale("pt-PT")).toBe("pt");
    expect(resolveLocale("en-US")).toBe("en");
    expect(resolveLocale("fr-FR")).toBe("pt"); // sem tradução → fonte
    expect(resolveLocale(undefined)).toBe("pt");
  });

  it("não deixa cair nem inventar chaves no EN", () => {
    // PT é a fonte: qualquer divergência é tradução em falta ou chave órfã.
    expect(keys(en).sort()).toEqual(keys(pt).sort());
  });

  it("mantém os mesmos placeholders nas duas línguas", () => {
    // `{name}` traduzido para `{nome}` rebenta em runtime, não na compilação.
    const enMap = new Map(entries(en));
    for (const [key, value] of entries(pt)) {
      expect(placeholders(enMap.get(key) ?? ""), key).toEqual(placeholders(value));
    }
  });

  it("não deixa mensagens vazias", () => {
    for (const [key, value] of [...entries(pt), ...entries(en)]) {
      expect(value.trim(), key).not.toBe("");
    }
  });
});
