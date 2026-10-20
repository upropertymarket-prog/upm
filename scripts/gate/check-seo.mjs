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

/**
 * Os idiomas que cada rota tem de declarar. Repetido aqui e não importado de
 * `@upm/config`: este script corre antes do build, sem resolver alias nem
 * TypeScript — é a mesma razão por que os campos se leem por regex.
 */
const LOCALES = ["pt", "en"];

/**
 * O corpo do bloco de um locale — de `pt: {` até ao `},` que o fecha, contando
 * chavetas para não parar numa interior.
 */
function blocoDoLocale(source, locale) {
  const abre = source.search(new RegExp(`\\b${locale}\\s*:\\s*\\{`));
  if (abre === -1) return null;

  const inicio = source.indexOf("{", abre);
  let profundidade = 0;
  for (let i = inicio; i < source.length; i += 1) {
    if (source[i] === "{") profundidade += 1;
    else if (source[i] === "}") {
      profundidade -= 1;
      if (profundidade === 0) return source.slice(inicio + 1, i);
    }
  }
  return null;
}

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

  if (!source.includes("export const seo")) {
    errors.push(`${route} — ${relative(".", seoPath)} não exporta \`seo\``);
    continue;
  }

  /**
   * Os dois idiomas, desde 20 out 2026 (D72).
   *
   * Até aqui cada `seo.ts` declarava um `PageSeo` só, e o site ficou nove
   * meses com a interface bilingue e os metadados monolíngues sem que nada
   * avisasse. É este o portão certo para o exigir: o `check-i18n` conta texto
   * escrito à mão nos componentes, e um `seo.ts` não é um componente — é a
   * fonte de verdade versionada dos metadados de uma rota, que o Admin
   * sobrepõe e as storyboards editam. Quem garante que está completa é quem
   * já garantia que existe.
   *
   * Corta-se o ficheiro no bloco de cada locale antes de procurar os campos:
   * sem isso, um `titleTag` presente só no `pt` dava o ficheiro por completo,
   * porque a regex encontrava-o em qualquer sítio.
   */
  for (const locale of LOCALES) {
    const bloco = blocoDoLocale(source, locale);
    if (bloco === null) {
      errors.push(`${route} — falta o bloco \`${locale}\` em ${relative(".", seoPath)}`);
      continue;
    }

    // Leitura por regex e não por import: este script corre antes do build e
    // não deve depender de resolver os alias de TypeScript.
    for (const field of ["pageName", "titleTag", "metaDescription"]) {
      const match = bloco.match(new RegExp(`${field}\\s*:\\s*"([^"]*)"`));
      if (!match || match[1].trim() === "") {
        errors.push(`${route} — \`${locale}.${field}\` em falta ou vazio`);
        continue;
      }
      const limit = LIMITS[field];
      if (limit && match[1].length > limit) {
        warnings.push(
          `${route} — \`${locale}.${field}\` com ${match[1].length} caracteres (máx. ${limit})`,
        );
      }
    }
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
