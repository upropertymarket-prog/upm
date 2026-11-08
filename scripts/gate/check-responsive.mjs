/**
 * Portão — grelhas e `ellipsis` que partem o ecrã estreito (02 §13).
 *
 * 02 §13 pede 360 px → 1920 px sem rolo horizontal. Os ecrãs estilizam-se com
 * `style={{}}` inline, que não tem media queries, por isso a responsividade
 * vive em CSS intrínseca — e há duas maneiras de a partir sem dar por isso.
 * São as duas mecânicas, e é por isso que cabem num portão em vez de numa
 * revisão:
 *
 *  1. `repeat(auto-fit, minmax(320px, 1fr))` — abaixo de 320 px a coluna não
 *     encolhe e empurra a página inteira. A cura é `min(100%, 320px)`, que é
 *     um no-op acima desse ponto.
 *
 *  2. `textOverflow: "ellipsis"` num item flex sem `minWidth: 0` — um item
 *     flex vale por omissão o tamanho do seu conteúdo, por isso o `…` nunca
 *     chega a acontecer e um URL ou email comprido estica o pai.
 *
 * O que isto **não** apanha é o transbordo que só existe depois de desenhado
 * (o `min-content` de 30 barras a mandar na largura do cartão, 8b0b2db). Para
 * esse há `scripts/audit-responsive.mjs`, que mede no browser — mas precisa do
 * host dos canvases a correr, e por isso é ferramenta local, não portão.
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

/** Grelha fluida cujo mínimo é um px pelado — sem o `min(100%, …)` que a salva. */
const BARE_MINMAX = /repeat\(\s*auto-(?:fit|fill)\s*,\s*minmax\(\s*(\d+)px/g;

/** Código-fonte e folhas de estilo; o resto não tem grelhas. */
function collect(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".next" ||
      entry.name === ".next-e2e" ||
      entry.name === ".next-e2e-pre" ||
      entry.name === "test-results" ||
      entry.name === "playwright-report" ||
      entry.name === ".git"
    )
      continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) collect(full, out);
    else if (/\.(tsx?|jsx?|mjs|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Número da linha de um índice, para a mensagem dizer onde é. */
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/**
 * Apaga comentários, substituindo-os por espaços para os índices — e portanto
 * os números de linha — continuarem a bater certo.
 *
 * Não é zelo: os comentários desta base explicam porque é que o código deixou
 * de ser o que era, e citam-no. `messages-screen.css` conta que as colunas já
 * foram `minmax(280px, 1fr)` — sem isto, o portão falhava na própria nota que
 * diz que o problema foi resolvido.
 */
const blank = (match) => match.replace(/[^\n]/g, " ");
const stripComments = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, blank)
    // Só `//` no início da linha: assim um `https://` dentro de uma string
    // continua intacto.
    .replace(/^[ \t]*\/\/[^\n]*/gm, blank);

/**
 * O literal de objeto que envolve `index` — anda para trás até à chaveta que o
 * abre e depois para a frente até à que o fecha. É o que permite perguntar
 * "este `ellipsis` tem `minWidth` **no mesmo** objeto?" sem montar um parser.
 */
function enclosingObject(text, index) {
  let depth = 0;
  let start = -1;
  for (let i = index; i >= 0; i--) {
    if (text[i] === "}") depth++;
    else if (text[i] === "{") {
      if (depth === 0) {
        start = i;
        break;
      }
      depth--;
    }
  }
  if (start < 0) return "";
  depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return text.slice(start, i + 1);
  }
  return "";
}

const grids = [];
const ellipsis = [];

for (const file of [...collect("apps"), ...collect("packages")]) {
  const text = stripComments(readFileSync(file, "utf8"));

  for (const match of text.matchAll(BARE_MINMAX)) {
    grids.push(`${file}:${lineOf(text, match.index)}  minmax(${match[1]}px, …)`);
  }

  let from = 0;
  for (;;) {
    const at = text.indexOf("ellipsis", from);
    if (at < 0) break;
    from = at + 8;
    const object = enclosingObject(text, at);
    // Só o caso sem ambiguidade: o próprio objeto declara `flex` (logo é item
    // flex, sem precisar de olhar para o pai) e não declara largura mínima.
    if (!/\bflex\s*:/.test(object)) continue;
    if (/\bminWidth\b|\bmin-width\b/.test(object)) continue;
    ellipsis.push(`${file}:${lineOf(text, at)}`);
  }
}

if (grids.length === 0 && ellipsis.length === 0) {
  console.log("✓ Responsivo: grelhas fluidas com `min(100%, …)` e `ellipsis` com largura mínima");
  process.exit(0);
}

if (grids.length > 0) {
  console.error("✗ Grelha fluida com mínimo em px pelado (02 §13):\n");
  for (const hit of grids) console.error(`      ${hit}`);
  console.error("\n  Abaixo do mínimo a coluna não encolhe e a página rola de lado.");
  console.error("  Use `minmax(min(100%, Npx), 1fr)` — acima de N px não muda nada.\n");
}

if (ellipsis.length > 0) {
  console.error("✗ `textOverflow: ellipsis` num item flex sem `minWidth: 0` (02 §13):\n");
  for (const hit of ellipsis) console.error(`      ${hit}`);
  console.error("\n  Sem largura mínima o item vale o tamanho do conteúdo: o `…` nunca");
  console.error("  acontece e um texto comprido estica o pai até fora do ecrã.\n");
}

process.exit(1);
