import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Testes das regras que não se negoceiam (04 §5.2 · 07 §3 · 07 §5.6 · 07 §5.14)
 * =========================================================================
 * Estas regras só valem se alguém as verificar em cada PR:
 *  1. só tokens — nenhuma cor literal fora de `tokens.css`;
 *  2. a paleta escura nunca divergir entre os dois blocos que a declaram;
 *  3. nenhum tamanho de letra abaixo de 13 px (14 px no `www`);
 *  4. nenhuma cor de estado a servir dois significados;
 *  5. todo o controlo interativo com alvo ≥ 40 px.
 */

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, "..");

const tokensCss = readFileSync(join(here, "tokens.css"), "utf8");
const componentsCss = readFileSync(join(here, "components.css"), "utf8");
const shellCss = readFileSync(join(here, "shell.css"), "utf8");

/** Comentários mencionam cores e seletores; nenhuma análise os deve ver. */
function stripCssComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === "files") continue; // binários das fontes
      walk(full, out);
    } else if (/\.(css|tsx?)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Corpos de todos os blocos de declarações cuja lista de seletores contém
 * exatamente `selector`.
 *
 * Um parser genérico em vez de `indexOf` sobre a string do seletor: a paleta
 * clara é declarada em `:root, [data-theme="light"]`, o `:root` está partido por
 * assunto, e o Prettier parte listas de seletores em várias linhas. Comparar
 * seletor a seletor é o que resiste a tudo isso.
 */
function bodies(css: string, selector: string): string[] {
  const clean = stripCssComments(css);
  const out: string[] = [];
  // Blocos de declarações: prefixo sem `{`/`}` seguido de um corpo sem `{`.
  // Chega para esta folha, que não tem regras aninhadas dentro de um seletor.
  for (const match of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = match[1]!
      .split(",")
      .map((part) => part.trim())
      // Um `@media {` deixa o seu nome pendurado no prefixo do primeiro bloco
      // interior; tira-se aqui.
      .map((part) => part.slice(part.lastIndexOf("{") + 1).trim())
      .filter(Boolean);
    if (selectors.includes(selector)) out.push(match[2]!);
  }
  return out;
}

/** `--bg: #f8fafc;` → `{ "--bg": "#f8fafc" }` */
function declarations(...cssBodies: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const body of cssBodies) {
    for (const line of body.split(";")) {
      const match = /^\s*(--[a-z0-9-]+)\s*:\s*(.+)$/is.exec(line);
      if (match) out[match[1]!] = match[2]!.trim().replace(/\s+/g, " ");
    }
  }
  return out;
}

function only(css: string, selector: string): string {
  const found = bodies(css, selector);
  expect(found.length, `bloco ${selector}`).toBe(1);
  return found[0]!;
}

const rootTokens = declarations(...bodies(tokensCss, ":root"));
const lightAttr = declarations(...bodies(tokensCss, '[data-theme="light"]'));
const darkExplicit = declarations(only(tokensCss, '[data-theme="dark"]'));
const darkFallback = declarations(only(tokensCss, ":root:not([data-theme])"));

describe("04 §5.1 — paleta", () => {
  it("declara os tokens de 04 §5.1 mais os de 07 §10", () => {
    const required = [
      "--bg",
      "--surface",
      "--surface2",
      "--surface3",
      "--border",
      "--border2",
      "--text",
      "--muted",
      "--accent",
      "--accent-hover",
      "--accent-soft",
      "--ok",
      "--ok-soft",
      "--warn",
      "--warn-soft",
      "--danger",
      "--danger-soft",
      "--info",
      "--info-soft",
      // 07 §10 — estavam nos protótipos e não na doc
      "--accent-ink",
      "--ph1",
      "--ph2",
    ];
    for (const token of required) expect(rootTokens, token).toHaveProperty(token);
  });

  it("usa exatamente os valores claros de 04 §5.1", () => {
    expect(rootTokens["--bg"]).toBe("#f8fafc");
    expect(rootTokens["--surface"]).toBe("#ffffff");
    expect(rootTokens["--surface2"]).toBe("#f1f5f9");
    expect(rootTokens["--surface3"]).toBe("#e9eef5");
    expect(rootTokens["--border"]).toBe("#e2e8f0");
    expect(rootTokens["--border2"]).toBe("#cbd5e1");
    expect(rootTokens["--text"]).toBe("#0f172a");
    expect(rootTokens["--muted"]).toBe("#64748b");
    expect(rootTokens["--accent"]).toBe("#ea580c");
    expect(rootTokens["--accent-hover"]).toBe("#c2410c");
    expect(rootTokens["--accent-soft"]).toBe("#fff1e7");
    expect(rootTokens["--accent-ink"]).toBe("#c2410c");
    expect(rootTokens["--ph1"]).toBe("#e4e9f0");
    expect(rootTokens["--ph2"]).toBe("#eef2f7");
  });

  it("usa exatamente os valores escuros de 04 §5.1", () => {
    expect(darkExplicit["--bg"]).toBe("#050a16");
    expect(darkExplicit["--surface"]).toBe("#0b1220");
    expect(darkExplicit["--surface2"]).toBe("#101b2e");
    expect(darkExplicit["--surface3"]).toBe("#16223a");
    expect(darkExplicit["--border"]).toBe("#1e293b");
    expect(darkExplicit["--border2"]).toBe("#2b3a52");
    expect(darkExplicit["--text"]).toBe("#e6edf6");
    expect(darkExplicit["--muted"]).toBe("#93a4bc");
    expect(darkExplicit["--accent"]).toBe("#f97316");
    // Os protótipos do proprietário tinham #C2410C aqui, ao contrário dos
    // outros três e da doc: 04 §5.1 ganha.
    expect(darkExplicit["--accent-hover"]).toBe("#fb923c");
    expect(darkExplicit["--accent-soft"]).toBe("#20130a");
    expect(darkExplicit["--accent-ink"]).toBe("#fdba74");
    expect(darkExplicit["--ph1"]).toBe("#101a2c");
    expect(darkExplicit["--ph2"]).toBe("#152338");
  });

  it("declara a paleta clara também por atributo, para ilhas de tema", () => {
    // Um `data-theme="light"` dentro de uma página escura tem de repor a paleta
    // clara inteira — é o que 07 §7 pede na demo do site público e o que faz os
    // canvases mostrarem claro e escuro lado a lado. Mesmo bloco, dois
    // seletores: não há segunda cópia para divergir.
    for (const token of Object.keys(darkExplicit)) {
      expect(lightAttr, `${token} em falta na ilha clara`).toHaveProperty(token);
      expect(lightAttr[token], token).toBe(rootTokens[token]);
    }
  });

  it("mantém os dois blocos escuros sincronizados", () => {
    // Um é a escolha explícita, o outro a rede de segurança sem JS. Divergirem
    // é o bug silencioso que este teste existe para apanhar.
    expect(darkFallback).toEqual(darkExplicit);
  });

  it("dá a todo o token de cor claro um par escuro", () => {
    const themeless = new Set(["--on-solid", "--logo-light", "--logo-dark"]);
    for (const [token, value] of Object.entries(rootTokens)) {
      if (themeless.has(token) || token.startsWith("--state-")) continue;
      if (!/#|rgb\(/.test(value)) continue; // só cores
      expect(darkExplicit, `${token} sem par escuro`).toHaveProperty(token);
    }
  });
});

describe("04 §5.6 — uma cor, um significado", () => {
  it("não repete valores entre tokens de estado sem exceção declarada", () => {
    const states = Object.entries(rootTokens).filter(([token]) => token.startsWith("--state-"));
    expect(states.length).toBeGreaterThan(10);

    const byValue = new Map<string, string[]>();
    for (const [token, value] of states) {
      const key = value.toLowerCase();
      byValue.set(key, [...(byValue.get(key) ?? []), token]);
    }

    // Exceções legítimas: famílias de estado que nunca aparecem no mesmo ecrã,
    // logo a cor não fica ambígua para quem olha. Ex.: `ticket-new` e
    // `ticket-triage` são o mesmo âmbar porque 07 §5.11 mapeia ambos para "Por
    // tratar"; o roxo de `ticket-awaiting` e o de `deal-rent` vêm os dois de
    // 04 §5.6 e vivem em produtos diferentes (Suporte vs Market).
    // Uma exceção nova só entra aqui com a justificação escrita.
    const allowed = new Set([
      "--state-visit-pending,--state-severity-high,--state-pending",
      "--state-visit-accepted,--state-deal-rented,--state-active",
      "--state-visit-rescheduled,--state-deal-sale",
      "--state-visit-cancelled,--state-severity-critical,--state-rejected",
      "--state-visit-completed,--state-ticket-closed",
      "--state-visit-archived,--state-severity-medium,--state-archived",
      "--state-ticket-new,--state-ticket-triage",
      "--state-ticket-awaiting,--state-deal-rent",
      "--state-severity-low,--state-draft",
    ]);

    for (const [value, tokens] of byValue) {
      if (tokens.length === 1) continue;
      expect(allowed, `${value} usado por ${tokens.join(", ")}`).toContain(tokens.join(","));
    }
  });
});

describe("04 §5.6 — as tags têm de ser legíveis", () => {
  /** Luminância relativa da WCAG 2.1 a partir de `#rrggbb`. */
  function luminance(hex: string): number {
    const channel = (value: number) => {
      const c = value / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  }

  function contrast(a: string, b: string): number {
    const [l1, l2] = [luminance(a), luminance(b)];
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  }

  it("dá a cada tom de estado ≥ 4.5:1 contra --on-solid", () => {
    // `.upm-tag` escreve --on-solid a 12 px / peso 550 sobre o tom sólido.
    // 12 px a peso 550 não chega a "texto grande" da WCAG (18.66 px), por isso o
    // critério é o AA normal de 4.5:1 e não o 3:1.
    const onSolid = rootTokens["--on-solid"]!;
    const offenders: string[] = [];

    for (const [token, value] of Object.entries(rootTokens)) {
      if (!token.startsWith("--state-")) continue;
      const ratio = contrast(onSolid, value);
      if (ratio < 4.5) offenders.push(`${token} (${value}): ${ratio.toFixed(2)}:1`);
    }

    expect(offenders).toEqual([]);
  });
});

describe("04 §5.2 — só tokens, nunca cores fixas", () => {
  it("não escreve cores literais fora de tokens.css", () => {
    const COLOR = /#[0-9a-f]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/i;
    const offenders: string[] = [];

    for (const file of walk(srcRoot)) {
      if (file.endsWith("tokens.css") || /\.test\.tsx?$/.test(file)) continue;
      const source = file.endsWith(".css")
        ? stripCssComments(readFileSync(file, "utf8"))
        : readFileSync(file, "utf8");

      for (const line of source.split("\n")) {
        const trimmed = line.trim();
        // Comentários de TS/TSX: `//`, `*`, `/*`.
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) {
          continue;
        }
        if (COLOR.test(line)) offenders.push(`${file}: ${trimmed}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("07 §3 — mínimo 13 px na app, 14 px no site público", () => {
  it("não usa tamanhos de letra abaixo de 13 px", () => {
    const offenders: string[] = [];
    for (const file of walk(srcRoot)) {
      if (/\.test\.tsx?$/.test(file)) continue;
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/font-size:\s*([0-9.]+)px/g)) {
        if (Number(match[1]) < 13) offenders.push(`${file}: ${match[0]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("fixa a escala de 07 §3 nos tokens", () => {
    expect(rootTokens["--fs-label"]).toBe("13px");
    expect(rootTokens["--fs-body"]).toBe("13px");
    expect(rootTokens["--fs-body-lg"]).toBe("14px");
    expect(rootTokens["--fs-subtitle"]).toBe("15px");
    expect(rootTokens["--fs-subtitle-lg"]).toBe("17px");
    expect(rootTokens["--fs-title-sm"]).toBe("22px");
  });

  it("sobe o mínimo para 14 px no site público", () => {
    const web = declarations(only(tokensCss, '[data-app="web"]'));
    expect(web["--fs-label"]).toBe("14px");
    expect(web["--fs-body"]).toBe("14px");
  });
});

/**
 * 04 §1.8, revisto a 30 set 2026
 * =========================================================================
 * A regra antiga — 07 §5.14, "alvos ≥ 40 px" — foi lida como "altura do botão
 * ≥ 40 px", e o resultado era uma app sem um único controlo abaixo de 40 px.
 * O cliente decidiu a 30 set 2026 separar as duas coisas:
 *
 *  - **altura visual**: 32 / 36 / 48 px, com 36 px por omissão;
 *  - **alvo de toque**: o 2.5.8 (AA) exige 24 × 24 px, e um controlo de 32 px
 *    passa pelo tamanho. Os 44 px são o 2.5.5, nível AAA, que este projeto não
 *    persegue.
 *
 * A exceção que se mantém, e é a que 07 §5.14 tinha realmente em mente:
 * **botões só de ícone nunca descem de 40 × 40 px** — sem rótulo não há onde
 * acertar. Vale também para os alvos sem texto do shell.
 *
 * Este teste passou a verificar a regra nova. A anterior exigia `--tap` em
 * todo o lado e falhava contra o CSS que já implementa 04 §1.8 — estava a
 * defender uma decisão substituída.
 */
describe("04 §1.8 — alturas dos controlos e alvos de toque", () => {
  it("define a escala 32 / 36 / 48 e o alvo mínimo de 40 px", () => {
    expect(rootTokens["--tap"]).toBe("40px");
    expect(rootTokens["--h-xs"]).toBe("32px");
    expect(rootTokens["--h-sm"]).toBe("36px");
    expect(rootTokens["--h-2xl"]).toBe("48px");
  });

  /** A altura que cada raiz clicável tem de declarar, e porquê. */
  const EXPECTED: Record<string, { token: string; why: string }> = {
    ".upm-btn--sm": { token: "--h-xs", why: "ações dentro de linhas e filtros" },
    ".upm-btn--md": { token: "--h-sm", why: "o padrão de 04 §1.8" },
    ".upm-btn--lg": { token: "--h-2xl", why: "CTA principal do site público" },
    ".upm-btn--icon": { token: "--tap", why: "sem rótulo não há onde acertar" },
    ".upm-control": { token: "--h-sm", why: "campo alinha com o botão md" },
    ".upm-tab": { token: "--h-sm", why: "tab alinha com o botão md" },
    ".upm-nav__item": { token: "--h-sm", why: "item de navegação com texto" },
    ".upm-toggle": { token: "--tap", why: "alvo sem rótulo" },
    ".upm-check": { token: "--tap", why: "alvo sem rótulo" },
    ".upm-page": { token: "--tap", why: "número de página, só dígito" },
    ".upm-menu__item": { token: "--tap", why: "alvo de menu" },
    ".upm-sidebar__report": { token: "--tap", why: "alvo a toda a largura" },
  };

  it("declara em cada controlo a altura que 04 §1.8 lhe dá", () => {
    const css = componentsCss + shellCss;

    for (const [selector, { token, why }] of Object.entries(EXPECTED)) {
      const found = bodies(css, selector);
      expect(found.length, `${selector} não declarado`).toBeGreaterThan(0);
      expect(found.join("\n"), `${selector} — ${why}`).toMatch(
        new RegExp(`(?:min-)?height:\\s*var\\(${token}\\)`),
      );
    }
  });

  it("nunca desce abaixo dos 24 px que o 2.5.8 (AA) exige", () => {
    for (const { token } of Object.values(EXPECTED)) {
      const value = Number.parseInt(rootTokens[token] ?? "0", 10);
      expect(value, token).toBeGreaterThanOrEqual(24);
    }
  });
});

describe("04 §5.5 — geometria do shell", () => {
  it("usa 248 px de sidebar, 84 px de rail, 68 px de topbar e 460 px de drawer", () => {
    expect(rootTokens["--sidebar-w"]).toBe("248px");
    // 04 §5.5 diz 84 px; os protótipos tinham 86 px. A doc ganha.
    expect(rootTokens["--sidebar-rail-w"]).toBe("84px");
    expect(rootTokens["--topbar-h"]).toBe("68px");
    expect(rootTokens["--drawer-w"]).toBe("460px");
  });
});
