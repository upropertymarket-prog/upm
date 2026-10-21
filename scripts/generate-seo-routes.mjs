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

/**
 * Os idiomas, repetidos aqui e não importados de `@upm/config`.
 *
 * Este script corre em Node antes de qualquer build, e importar um `.ts` do
 * monorepo obrigava-o a resolver alias e a passar por um transpilador — é a
 * mesma razão por que lê os `seo.ts` por regex em vez de os importar. São duas
 * palavras; o que as mantém honestas é o `check-seo`, que falha se um `seo.ts`
 * não declarar exatamente os idiomas que o produto serve.
 */
const LOCALES = ["pt", "en"];

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
 * O bloco de um idioma dentro de um `seo.ts` bilingue (21 out 2026, D72 fase C).
 *
 * **Isto existia em falta e dava um resultado errado em silêncio.** Desde a
 * fase A um `seo.ts` declara `{ pt: {…}, en: {…} }`, e o `field` acima apanha a
 * **primeira** ocorrência do nome no ficheiro — que é sempre a do bloco
 * português. O inventário ficava com os textos portugueses, e o painel de
 * `/admin/seo` mostrava a predefinição portuguesa como se fosse a de qualquer
 * idioma. Ninguém reparava porque uma predefinição é só informação: não se
 * publica, e por isso não quebrava página nenhuma — exatamente a forma de
 * falha que o resto desta dívida tem tido.
 *
 * Corte por chaves equilibradas e não por regex: `{ pt: { … }, en: { … } }`
 * tem chaves aninhadas, e um `[^}]*` parava na primeira que encontrasse —
 * dentro do bloco, não no fim dele.
 */
function localeBlock(source, locale) {
  const start = source.match(new RegExp(`\\b${locale}\\s*:\\s*\\{`));
  if (!start) return "";

  let depth = 0;
  for (let i = start.index + start[0].length - 1; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start.index, i + 1);
    }
  }
  return "";
}

/**
 * Os textos de uma rota, por idioma.
 *
 * Um bloco em falta devolve cadeias vazias em vez de cair no outro idioma.
 * Quem falha por um `seo.ts` incompleto é o `check-seo`, que exige os dois
 * blocos desde a fase A; aqui preencher com o português escondia-lhe o
 * trabalho e punha no painel uma predefinição que a página não tem.
 */
function textsByLocale(source) {
  const texts = {};
  for (const locale of LOCALES) {
    const block = localeBlock(source, locale);
    texts[locale] = {
      pageName: field(block, "pageName"),
      titleTag: field(block, "titleTag"),
      metaDescription: field(block, "metaDescription"),
    };
  }
  return texts;
}

/**
 * Campo booleano, pela mesma leitura por regex. Ausente conta como `false`, que
 * é o mesmo que o `buildMetadata` assume — uma rota sem `noindex` é indexável.
 */
function flag(source, name) {
  return new RegExp(`${name}\\s*:\\s*true`).test(source);
}

/**
 * Os caminhos por idioma, lidos de `apps/web/src/i18n/pathnames.ts`.
 *
 * O Admin vive noutra aplicação Next e não pode importar o mapa; mas precisa
 * dele, porque desde 21 out 2026 **os caminhos traduzem-se** e a
 * pré-visualização do resultado no Google tem de mostrar o URL que o visitante
 * vê. Sem isto, a aba inglesa do painel mostrava `upropertymarket.pt/termos`
 * para uma página servida em `/en/terms` — uma pré-visualização que mente é
 * pior do que nenhuma, porque é a partir dela que alguém decide se o título
 * cabe.
 *
 * É o mesmo padrão de todo este ficheiro: um valor que vive num sítio, copiado
 * por um script para onde é preciso, e nunca escrito à mão nos dois.
 */
function pathsByLocale() {
  const source = readFileSync("apps/web/src/i18n/pathnames.ts", "utf8");
  const map = {};

  // Forma curta: `"/": "/"` — o mesmo caminho nos dois idiomas.
  for (const [, key, value] of source.matchAll(/"(\/[^"]*)":\s*"([^"]*)"/g)) {
    map[key] = Object.fromEntries(LOCALES.map((loc) => [loc, value]));
  }

  // Forma longa: `"/termos": { pt: "/termos", en: "/terms" }`, possivelmente
  // partida em várias linhas pelo prettier.
  for (const [, key, body] of source.matchAll(/"(\/[^"]*)":\s*\{([^}]*)\}/g)) {
    const entry = {};
    for (const loc of LOCALES) {
      const found = body.match(new RegExp(`\\b${loc}\\s*:\\s*"([^"]*)"`));
      if (found) entry[loc] = found[1];
    }
    if (Object.keys(entry).length === LOCALES.length) map[key] = entry;
  }

  return map;
}

/** O caminho público de uma rota, com o prefixo de idioma de `as-needed`. */
function publicPath(paths, route, locale) {
  const path = paths[route]?.[locale] ?? route;
  if (locale === LOCALES[0]) return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

const paths = pathsByLocale();
const routes = [];
for (const dir of findSeoDirs(ROOT).sort()) {
  /**
   * O `[locale]` sai do caminho (20 out 2026).
   *
   * As páginas do site passaram a viver em `app/[locale]/`, para o idioma
   * entrar no URL (`/en`). Sem este corte, o inventário passava a declarar
   * `/[locale]/termos` — e esse não é o caminho de nada: a rota **é** `/termos`,
   * servida em `/termos` e em `/en/termos`.
   *
   * A chave sem prefixo é a identidade da página no resto do sistema: é por
   * ela que a tabela `seo_pages` guarda a sobreposição (uma linha por rota **e
   * idioma** desde 21 out 2026, mas a rota é a mesma nas duas: o idioma é a
   * outra metade da chave, não parte dela), é ela que o `sitemap` localiza
   * para cada língua, e é
   * dela que o `buildMetadata` deriva o canonical e o `hreflang`. Pôr o
   * segmento aqui obrigava todos esses a saber tirá-lo.
   */
  const segments = relative(ROOT, dir)
    .split(/[\\/]/)
    .filter(Boolean)
    .filter((segment) => segment !== "[locale]");
  const route = "/" + segments.join("/");
  let source;
  try {
    source = readFileSync(join(dir, "seo.ts"), "utf8");
  } catch {
    // `check-seo` é quem falha por um `seo.ts` em falta; aqui ignora-se, para
    // os dois não darem o mesmo erro com palavras diferentes.
    continue;
  }
  const key = route === "/" ? "/" : route.replace(/\/$/, "");
  routes.push({
    route: key,
    text: textsByLocale(source),
    // O URL público em cada idioma, para a pré-visualização do painel.
    path: Object.fromEntries(LOCALES.map((loc) => [loc, publicPath(paths, key, loc)])),
    // Rotas dinâmicas usam o registo como template (04 §2.1.2).
    dynamic: segments.some((segment) => segment.startsWith("[")),
    // Para o sitemap saber o que não deve listar — ver `app/sitemap.ts`.
    //
    // **Por rota e não por idioma**, embora o campo viva dentro de cada bloco:
    // o sitemap lista ou não lista um URL, e as duas versões de uma página
    // transacional são a mesma decisão. Verdadeiro se qualquer bloco o disser,
    // porque entre "esconder uma página que devia ser indexada" e "indexar uma
    // que devia estar escondida" o erro caro é o segundo.
    noindex: flag(source, "noindex"),
  });
}

const source = `// GERADO POR scripts/generate-seo-routes.mjs — NÃO EDITAR À MÃO.
// Corra \`pnpm seo:routes\` depois de criar ou alterar um \`seo.ts\`.
//
// O inventário das rotas públicas do \`apps/web\`, com os valores por omissão
// que vivem no ficheiro de cada uma. \`/admin/seo\` cruza isto com \`seo_pages\`
// para saber que páginas existem e quais foram personalizadas — ver 04 §2.1.1.

/** Os textos versionados de uma rota, num idioma. */
export type SeoRouteText = {
  /** Nome legível, para a lista do Admin. */
  pageName: string;
  /** O valor versionado, mostrado como "predefinição" no editor. */
  titleTag: string;
  metaDescription: string;
};

export type SeoRoute = {
  /** O caminho da página: "/", "/termos", … A mesma chave nos dois idiomas. */
  route: string;
  /**
   * Os textos por idioma. Era um conjunto único até 21 out 2026, e nessa forma
   * dava sempre o português: o painel mostrava a predefinição portuguesa como
   * predefinição de qualquer idioma.
   */
  text: Record<"pt" | "en", SeoRouteText>;
  /**
   * O URL público em cada idioma, prefixo incluído: \`/termos\` e \`/en/terms\`.
   * Lido de \`apps/web/src/i18n/pathnames.ts\` — o Admin não pode importá-lo.
   */
  path: Record<"pt" | "en", string>;
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
