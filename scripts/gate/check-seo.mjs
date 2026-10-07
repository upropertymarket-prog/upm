#!/usr/bin/env node
/**
 * check-seo — nenhuma rota pública sem SEO (P2-06 · 04 §2.1.2 AC #5)
 * =========================================================================
 * Varre `apps/web/src/app` e exige, para cada `page.tsx` **público**, um
 * `seo.ts` ao lado com `pageName`, `titleTag` e `metaDescription`. Falha o PR
 * quando falta — que é o ponto todo: uma rota nova sem SEO é uma página que
 * entra em produção sem título e sem cartão de partilha, e isso descobre-se
 * sempre tarde, quando alguém partilha o link.
 *
 * Verifica também os limites de 04 §2.1.1 (60 e 160 caracteres). Aí **avisa**
 * em vez de falhar: um título com 62 caracteres é um problema de copy a
 * corrigir, não uma razão para travar um PR que mexe noutra coisa.
 *
 * O que não conta como rota pública: grupos de rotas e pastas internas do
 * Next e do Tempo (`__tempo`, `api`, `auth`), que não são páginas.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "apps/web/src/app";
const LIMITS = { titleTag: 60, metaDescription: 160 };
const SKIP = new Set(["api", "auth", "%5F%5Ftempo", "__tempo"]);

/** Encontra todos os `page.tsx` com o diretório em que vivem. */
function findPages(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (SKIP.has(entry)) continue;
      found.push(...findPages(full));
    } else if (entry === "page.tsx") {
      found.push(dir);
    }
  }
  return found;
}

const errors = [];
const warnings = [];
let checked = 0;

for (const dir of findPages(ROOT)) {
  const route = "/" + relative(ROOT, dir).split(/[\\/]/).filter(Boolean).join("/");
  const seoPath = join(dir, "seo.ts");

  let source;
  try {
    source = readFileSync(seoPath, "utf8");
  } catch {
    errors.push(`${route} — falta ${relative(".", seoPath)}`);
    continue;
  }
  checked++;

  // Leitura por regex e não por import: este script corre antes do build e
  // não deve depender de resolver os alias de TypeScript.
  for (const field of ["pageName", "titleTag", "metaDescription"]) {
    const match = source.match(new RegExp(`${field}\\s*:\\s*"([^"]*)"`));
    if (!match || match[1].trim() === "") {
      errors.push(`${route} — \`${field}\` em falta ou vazio`);
      continue;
    }
    const limit = LIMITS[field];
    if (limit && match[1].length > limit) {
      warnings.push(`${route} — \`${field}\` com ${match[1].length} caracteres (máx. ${limit})`);
    }
  }

  if (!source.includes("export const seo")) {
    errors.push(`${route} — ${relative(".", seoPath)} não exporta \`seo\``);
  }
}

for (const warning of warnings) console.warn(`  aviso  ${warning}`);
if (errors.length > 0) {
  console.error("\n✗ SEO incompleto:\n");
  for (const error of errors) console.error(`  erro   ${error}`);
  console.error(
    `\n${errors.length} erro(s). Cada rota pública precisa de um \`seo.ts\` ao lado do \`page.tsx\` (04 §2.1.2).\n`,
  );
  process.exit(1);
}

console.log(
  `✓ SEO presente em ${checked} rotas públicas` +
    (warnings.length > 0 ? ` (${warnings.length} aviso(s) de comprimento)` : ""),
);
