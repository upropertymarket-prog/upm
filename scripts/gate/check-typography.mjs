/**
 * Portão — pesos de letra fora da escala (04 §5.3 · 07 §3).
 *
 * A 26 out 2026 a app tinha os pesos invertidos: labels de campo e cabeçalhos
 * de tabela liam-se a 800 e os títulos a 400. Não era descuido pontual — era o
 * resultado de três mecânicas que, sozinhas, ninguém nota numa revisão:
 *
 *  1. **O preflight do Tailwind v4** põe `h1…h6 { font-weight: inherit }`. Sem
 *     uma regra de elemento no design system, todo o `<h1>` sem classe cai no
 *     peso do `body`. Eram 36 em código de produto.
 *
 *  2. **Um token acima do teto da fonte dos títulos.** A Bricolage está
 *     declarada em 500–700 e a Manrope em 400–800; bastou existir um
 *     `--fw-black: 800` ao alcance do cromado para o cromado passar à frente
 *     de qualquer título, sem que nenhum título lhe pudesse responder.
 *
 *  3. **Pesos escritos a literal.** Eram 51 `fontWeight:` numéricos em 23
 *     ficheiros. Um literal não se liga a token nenhum, logo não acompanha
 *     mudanças de escala e não aparece em nenhuma busca por `--fw-`.
 *
 * As três são verificáveis por leitura do código, e é por isso que cabem aqui
 * em vez de numa revisão visual. O que este portão **não** faz é julgar se o
 * peso escolhido é o certo para o papel: isso vê-se no storyboard "Tipografia"
 * das Fundações, e com os olhos.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** O teto da escala. A Bricolage, que escreve os títulos, acaba aqui. */
const TETO = 700;

/**
 * As exceções têm todas a mesma forma: o alvo não é um browser, e portanto não
 * há CSS variables para resolver — um `var(--fw-semibold)` sairia de lá sem
 * peso nenhum. Não é folga de estilo, é o meio.
 *
 *  - `apps/web/src/app/og` — o Satori (`next/og`) desenha a imagem social fora
 *    do browser.
 *  - `packages/db/src/campaign-render.tsx` — React Email. O Gmail remove o
 *    `<style>` do cabeçalho e o Outlook renderiza com o motor do Word; o estilo
 *    vai em linha e em números.
 *
 * `dist` não é exceção, é artefacto: o código compilado herda o que a fonte
 * tiver, e verificá-lo era contar o mesmo defeito duas vezes.
 */
const EXCECOES = [
  join("apps", "web", "src", "app", "og"),
  join("packages", "db", "src", "campaign-render.tsx"),
];

function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".next-e2e" || entry.name === "test-results" || entry.name === "playwright-report" || entry.name === ".git") continue;
    if (entry.name === "dist" || entry.name === "build") continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (/\.(tsx?|jsx?|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/**
 * Apaga comentários mantendo os índices — como em `check-responsive.mjs`, e
 * pela mesma razão: os comentários desta base citam o defeito que explicam,
 * e sem isto o portão falhava na própria nota que diz que já está resolvido.
 */
const blank = (match) => match.replace(/[^\n]/g, " ");
const stripComments = (text) =>
  text.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^[ \t]*\/\/[^\n]*/gm, blank);

const literaisJs = [];
const literaisCss = [];
const tokensAltos = [];
const classesPesadas = [];

const TOKENS = join("packages", "ui", "src", "styles", "tokens.css");
const COMPONENTES = join("packages", "ui", "src", "styles", "components.css");

/**
 * A raiz é injetável para o teste negativo lhe poder apontar um fixture em vez
 * do repositório. Sem isto, provar que o portão falha obrigava a sujar `apps/`
 * com violações de propósito — e um portão que ninguém viu falhar é um portão
 * em que ninguém devia confiar.
 */
const RAIZ = process.env.UPM_TIPOGRAFIA_RAIZ ?? ".";
const sob = (p) => join(RAIZ, p);

for (const file of [
  ...collect(sob("apps")),
  ...collect(sob("packages")),
  ...collect(sob("tempo/designs")),
]) {
  if (EXCECOES.some((e) => file.includes(e))) continue;
  const text = stripComments(readFileSync(file, "utf8"));

  if (file.endsWith(".css")) {
    // Em `tokens.css` os números são a definição da escala; em qualquer outra
    // folha são um valor solto que a escala não conhece.
    if (file.endsWith(TOKENS)) {
      for (const m of text.matchAll(/--fw-[a-z]+:\s*(\d+)/g)) {
        if (Number(m[1]) > TETO) tokensAltos.push(`${file}:${lineOf(text, m.index)}  ${m[0]}`);
      }
      continue;
    }
    for (const m of text.matchAll(/font-weight:\s*(\d{3}|bold(?:er)?|normal)\b/g)) {
      literaisCss.push(`${file}:${lineOf(text, m.index)}  font-weight: ${m[1]}`);
    }
    continue;
  }

  for (const m of text.matchAll(/fontWeight:\s*"?(\d{3})"?/g)) {
    literaisJs.push(`${file}:${lineOf(text, m.index)}  fontWeight: ${m[1]}`);
  }
  // `font-extrabold` e `font-black` do Tailwind são 800 e 900 por outra porta.
  for (const m of text.matchAll(/\bfont-(extrabold|black)\b/g)) {
    classesPesadas.push(`${file}:${lineOf(text, m.index)}  font-${m[1]}`);
  }
}

/**
 * A regra de elemento é o que impede os cabeçalhos de voltarem a cair no peso
 * do `body`. Sem ela, as outras quatro verificações passam e o defeito volta
 * inteiro — por isso vale a pena afirmá-la, e não só confiar que lá está.
 */
const temRegraDeCabecalho = existsSync(sob(COMPONENTES))
  ? /h1,\s*h2,\s*h3\s*\{[^}]*font-weight/.test(readFileSync(sob(COMPONENTES), "utf8"))
  : false;

const falhas = literaisJs.length + literaisCss.length + tokensAltos.length + classesPesadas.length;

if (falhas === 0 && temRegraDeCabecalho) {
  console.log("✓ Tipografia: pesos por token, escala até " + TETO + ", cabeçalhos com regra");
  process.exit(0);
}

if (!temRegraDeCabecalho) {
  console.error("✗ `components.css` já não declara o peso de h1–h3 (04 §5.3):\n");
  console.error("      packages/ui/src/styles/components.css");
  console.error("\n  O preflight do Tailwind põe `h1…h6 { font-weight: inherit }`. Sem esta");
  console.error("  regra, todo o cabeçalho sem classe passa a herdar o peso do `body`.\n");
}

if (tokensAltos.length > 0) {
  console.error(`✗ Token de peso acima de ${TETO} (04 §5.3):\n`);
  for (const hit of tokensAltos) console.error(`      ${hit}`);
  console.error("\n  A Bricolage, que escreve os títulos, está declarada em 500–700. Um token");
  console.error("  acima disso só é alcançável pelo texto em Manrope — ou seja, pelo cromado,");
  console.error("  que passaria à frente dos títulos sem resposta possível.\n");
}

if (literaisJs.length > 0) {
  console.error("✗ Peso escrito a literal em JSX (04 §5.3):\n");
  for (const hit of literaisJs) console.error(`      ${hit}`);
  console.error("\n  Use `var(--fw-regular|medium|mid|semibold|bold)`. Um número não se liga");
  console.error("  à escala: não acompanha mudanças e não aparece numa busca por `--fw-`.\n");
}

if (literaisCss.length > 0) {
  console.error("✗ Peso escrito a literal em CSS (04 §5.3):\n");
  for (const hit of literaisCss) console.error(`      ${hit}`);
  console.error("\n  Os números da escala vivem em `tokens.css` e só lá. Qualquer outra folha");
  console.error("  consome-os por `var(--fw-…)`.\n");
}

if (classesPesadas.length > 0) {
  console.error(`✗ Classe do Tailwind acima de ${TETO} (04 §5.3):\n`);
  for (const hit of classesPesadas) console.error(`      ${hit}`);
  console.error("\n  `font-extrabold` é 800 e `font-black` é 900 — o mesmo 800 que foi");
  console.error("  eliminado da escala, a entrar por outra porta. Use `font-semibold`.\n");
}

process.exit(1);
