#!/usr/bin/env node
/**
 * generate-seo-routes — o inventário de rotas públicas, para o Admin (P2-06)
 * =========================================================================
 * `/admin/seo` tem de listar "uma linha por página pública, gerada a partir do
 * mapa de rotas do `apps/web` + `seo_pages`" (04 §2.1.1). Só que o Admin vive
 * em `apps/interno`, que é **outra aplicação Next**: não importa código do
 * `apps/web` nem lhe lê os ficheiros em produção, onde só existe o build.
 *
 * Daí este script. Varre os `seo.ts` do `apps/web` e escreve o inventário em
 * `packages/config/seo-routes.generated.ts`, que as duas apps podem importar.
 * É o mesmo padrão do `extract-legal-drafts.mjs`: um valor que vive num sítio,
 * copiado para onde é preciso por um script, e nunca escrito à mão nos dois —
 * porque duas cópias escritas à mão divergem à primeira alteração.
 *
 * O `check-seo` do CI corre isto em modo `--check` e falha se o ficheiro
 * gerado estiver desatualizado. Sem isso, uma rota nova aparecia no site e
 * nunca no painel de SEO, e ninguém daria por ela.
 *
 *   node scripts/generate-seo-routes.mjs           escreve
 *   node scripts/generate-seo-routes.mjs --check   só verifica
 */

import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import prettier from "prettier";

const ROOT = "apps/web/src/app";
const OUT = "packages/config/seo-routes.generated.ts";
const SKIP = new Set(["api", "auth", "%5F%5Ftempo", "__tempo"]);

function findSeoDirs(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (SKIP.has(entry)) continue;
      found.push(...findSeoDirs(full));
    } else if (entry === "page.tsx") {
      found.push(dir);
    }
  }
  return found;
}

/**
 * Leitura por regex e não por import, pela mesma razão do `check-seo`: isto
 * corre antes do build e não deve depender de resolver os alias de TypeScript.
 */
function field(source, name) {
  const match = source.match(new RegExp(`${name}\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
  return match ? match[1].replace(/\\"/g, '"') : "";
}

/**
 * Campo booleano, pela mesma leitura por regex. Ausente conta como `false`, que
 * é o mesmo que o `buildMetadata` assume — uma rota sem `noindex` é indexável.
 */
function flag(source, name) {
  return new RegExp(`${name}\\s*:\\s*true`).test(source);
}

const routes = [];
for (const dir of findSeoDirs(ROOT).sort()) {
  const segments = relative(ROOT, dir).split(/[\\/]/).filter(Boolean);
  const route = "/" + segments.join("/");
  let source;
  try {
    source = readFileSync(join(dir, "seo.ts"), "utf8");
  } catch {
    // `check-seo` é quem falha por um `seo.ts` em falta; aqui ignora-se, para
    // os dois não darem o mesmo erro com palavras diferentes.
    continue;
  }
  routes.push({
    route: route === "/" ? "/" : route.replace(/\/$/, ""),
    pageName: field(source, "pageName"),
    titleTag: field(source, "titleTag"),
    metaDescription: field(source, "metaDescription"),
    // Rotas dinâmicas usam o registo como template (04 §2.1.2).
    dynamic: segments.some((segment) => segment.startsWith("[")),
    // Para o sitemap saber o que não deve listar — ver `app/sitemap.ts`.
    noindex: flag(source, "noindex"),
  });
}

const source = `// GERADO POR scripts/generate-seo-routes.mjs — NÃO EDITAR À MÃO.
// Corra \`pnpm seo:routes\` depois de criar ou alterar um \`seo.ts\`.
//
// O inventário das rotas públicas do \`apps/web\`, com os valores por omissão
// que vivem no ficheiro de cada uma. \`/admin/seo\` cruza isto com \`seo_pages\`
// para saber que páginas existem e quais foram personalizadas — ver 04 §2.1.1.

export type SeoRoute = {
  /** O caminho da página: "/", "/termos", … */
  route: string;
  /** Nome legível, para a lista do Admin. */
  pageName: string;
  /** O valor versionado, mostrado como "predefinição" no editor. */
  titleTag: string;
  metaDescription: string;
  /** Rotas com segmento \`[slug]\`: o registo é um template. */
  dynamic: boolean;
  /** \`noindex: true\` no \`seo.ts\`. O sitemap exclui estas rotas. */
  noindex: boolean;
};

export const SEO_ROUTES: readonly SeoRoute[] = ${JSON.stringify(routes, null, 2)} as const;
`;

// Formatado aqui e não num passo à parte, como faz o `db:types`: um ficheiro
// gerado que o `format:check` recusa falha o CI por uma razão que não tem nada
// a ver com quem o gerou, e obrigaria a correr dois comandos em vez de um.
const body = await prettier.format(source, {
  ...(await prettier.resolveConfig(OUT)),
  filepath: OUT,
});

const previous = (() => {
  try {
    return readFileSync(OUT, "utf8");
  } catch {
    return null;
  }
})();

// Comparação com as quebras de linha normalizadas: no Windows o ficheiro em
// disco tem CRLF e o que geramos aqui tem LF. Sem isto, o `--check` falhava
// em todas as máquinas Windows por uma diferença que o git já resolve.
const same = previous !== null && previous.replace(/\r\n/g, "\n") === body.replace(/\r\n/g, "\n");

if (process.argv.includes("--check")) {
  if (!same) {
    console.error(
      `\n✗ ${OUT} está desatualizado.\n\n  Corra \`pnpm seo:routes\` e inclua o ficheiro no commit.\n`,
    );
    process.exit(1);
  }
  console.log(`✓ ${OUT} atualizado (${routes.length} rotas)`);
} else {
  if (!same) writeFileSync(OUT, body, "utf8");
  console.log(`✓ ${routes.length} rotas públicas escritas em ${OUT}`);
}
