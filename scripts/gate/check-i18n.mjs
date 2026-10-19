import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Portão de i18n — texto visível tem de vir do ficheiro de mensagens
 * ===========================================================================
 * 02 §12 e 07 §5.13: o produto é bilingue, em todas as apps. O projeto tem
 * tudo o que isso precisa — `next-intl`, `pt.json`/`en.json`, seletor de idioma
 * nas três apps — e mesmo assim 38 ficheiros tinham texto em português escrito
 * à mão, descoberto a 15 out 2026 ao construir a Cloud interna (P10-10).
 *
 * ## Porque é que o teste que já existia não apanhava isto
 *
 * `packages/config/messages.test.ts` compara `pt.json` com `en.json`: garante
 * que nenhuma chave cai nem inventa placeholders. É útil e não serve aqui —
 * **só vê as chaves que existem**. Uma frase que nunca chegou a ser chave não
 * aparece em nenhum dos dois ficheiros, e a paridade continua perfeita. Era
 * confiança falsa: todos os portões verdes, metade do produto monolingue.
 *
 * Este portão olha para o lado oposto: o código. Marca **strings**, não
 * ficheiros — um ecrã pode usar `useTranslations` e na mesma ter três frases à
 * mão, e era exatamente assim que a maioria delas estava.
 *
 * ## O que conta como texto visível
 *
 * 1. Texto solto em JSX: `<p>Sem visitas neste filtro</p>`.
 * 2. Literais em props que o utilizador lê: `title`, `label`, `placeholder`,
 *    `aria-label`, `alt`, `hint`, `subtitle`, `caption`, `description`,
 *    `header`, `empty`.
 * 3. O primeiro argumento de `toast(...)`, que é uma frase dita ao utilizador.
 *
 * ## O que não conta, e porquê
 *
 * - **Comentários.** São retirados antes de olhar — foi o primeiro erro da
 *   versão anterior desta varredura, que os contava como texto.
 * - **Valores técnicos**: tipos MIME, `_blank`, `noopener`, URLs, unidades CSS,
 *   `var(--token)`, cores, e identificadores sem espaços.
 * - **`packages/ui`**: os componentes do design system recebem `labels` por
 *   props, de propósito — o texto deles é de quem os monta. Exceto o que lá
 *   estiver escrito à mão, que é falha na mesma; por isso varre-se também, só
 *   sem as fixtures.
 * - **Fixtures, testes e canvases**: dados de exemplo não são produto.
 *
 * ## Porque é que ainda não está no `pnpm gate`
 *
 * Porque nasce **vermelho**: 344 strings em 68 ficheiros, a 15 out 2026. Pô-lo
 * já no agregado deixava o portão inteiro vermelho e, com ele, inútil — a
 * primeira coisa que se faz a um portão que falha sempre é parar de o correr.
 *
 * Entra no `pnpm gate` **no commit que levar a contagem a zero**, e é essa a
 * definição de pronto desta dívida. Até lá corre-se à mão, `pnpm gate:i18n`,
 * e a contagem só pode descer: é por isso que ele imprime o total em vez de se
 * limitar a falhar.
 */

const RAIZES = ["apps/web/src", "apps/app/src", "apps/interno/src", "packages/ui/src"];

/** Pastas que nunca são produto. */
const IGNORAR_PASTAS = new Set(["node_modules", ".next", "dist", "demo-data", "__tests__"]);

/**
 * Ficheiros isentos, cada um com a razão. A lista é curta de propósito: cada
 * entrada é uma desculpa, e uma desculpa sem data de fim transforma-se em
 * regra.
 */
const ISENTOS = new Map([
  [
    "apps/app/src/components/ComponentsPreview.tsx",
    "Mostruário de transição com dados fixos: existe para se verem os 14 componentes base num ecrã verdadeiro e para a Route Storyboard do design system ter onde apontar (07 §4.5). O próprio `apps/app/src/app/page.tsx` diz que desaparece quando o Painel do comprador nascer (04 §8.2). Traduzir dados de exemplo de um ecrã marcado para sair é trabalho que se deita fora.",
  ],
]);

/** Props cujo valor o utilizador lê. */
const PROPS_VISIVEIS =
  /\b(title|label|placeholder|aria-label|alt|hint|subtitle|description|caption|header|empty|confirmLabel|cancelLabel)\s*=\s*"([^"\n]+)"/g;

/** `toast("frase")` — uma mensagem dita a quem está a usar o produto. */
const TOAST = /\btoast\(\s*"([^"\n]+)"/g;

/**
 * Texto entre tags: `<p>Calendário</p>`.
 *
 * O fecho tem de ser **uma tag de fecho** (`</`) e não um `<` qualquer. Sem
 * isso, o padrão apanhava `emails.length > 1 && email ? (` e genéricos como
 * `TableColumn<Row>` — foi o primeiro ruído a aparecer, e tirou a confiança ao
 * portão até estar resolvido. O preço é não ver texto seguido de outra tag
 * (`<p>Olá <b>Ana</b></p>` perde o "Olá "), que é um falso negativo barato.
 */
const TEXTO_JSX = />\s*([^<>{}\n]+?)\s*<\//g;

/**
 * O que é técnico e não é frase. Um identificador sem espaços, um tipo MIME, um
 * caminho, uma unidade — nada disto se traduz.
 */
const TECNICO = [
  /^[a-z0-9_-]+$/i, // identificador numa palavra
  /^[a-z]+\/[a-z0-9.+-]+$/i, // MIME
  /^[\w.-]+@[\w.-]+$/, // e-mail
  /^https?:\/\//,
  /^[./#]/, // caminho, âncora
  /^var\(--/,
  /^#[0-9a-f]{3,8}$/i,
  /^\d+(\.\d+)?(px|rem|em|%|fr|vh|vw|s|ms)?$/,
  /^[\s\p{P}\p{S}]+$/u, // só pontuação ou símbolos
  /^(noopener|noreferrer|_blank|_self|true|false|null|undefined)$/,
  /^[a-z-]+(\s+[a-z-]+)*$/, // lista de classes ou de valores, tudo minúsculo
];

/** Frases que são a marca ou convenções que não se traduzem. */
const PERMITIDAS = new Set([
  "UProperty Market",
  "UProperty",
  "OK",
  "PDF",
  "CSV",
  "JPG",
  "PNG",
  "SEO",
  "IMAP",
  "SMTP",
  "RGPD",
  "IBAN",
  "NIF",
]);

function ficheiros(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR_PASTAS.has(entrada.name)) continue;
    const completo = join(dir, entrada.name);
    if (entrada.isDirectory()) ficheiros(completo, out);
    else if (/\.tsx$/.test(entrada.name) && !/\.(test|spec)\.tsx$/.test(entrada.name))
      out.push(completo);
  }
  return out;
}

/**
 * Tira comentários sem tocar no resto, e **preservando as quebras de linha**
 * para os números de linha continuarem a bater certo com o ficheiro original.
 */
function semComentarios(fonte) {
  let saida = "";
  let i = 0;
  const fim = fonte.length;

  while (i < fim) {
    const c = fonte[i];
    const prox = fonte[i + 1];

    // Comentário de linha: desaparece até à quebra, que fica.
    if (c === "/" && prox === "/") {
      while (i < fim && fonte[i] !== "\n") i += 1;
      continue;
    }

    // Comentário de bloco: desaparece, mas as quebras ficam — é o que mantém
    // os números de linha a bater certo com o ficheiro original.
    if (c === "/" && prox === "*") {
      i += 2;
      while (i < fim && !(fonte[i] === "*" && fonte[i + 1] === "/")) {
        if (fonte[i] === "\n") saida += "\n";
        i += 1;
      }
      i += 2;
      continue;
    }

    // String: copia-se inteira, de uma vez, para que um `//` lá dentro não
    // seja lido como comentário.
    if (c === '"' || c === "'" || c === "`") {
      saida += c;
      i += 1;
      while (i < fim) {
        if (fonte[i] === "\\") {
          saida += fonte[i] + (fonte[i + 1] ?? "");
          i += 2;
          continue;
        }
        saida += fonte[i];
        const fecha = fonte[i] === c;
        i += 1;
        if (fecha) break;
      }
      continue;
    }

    saida += c;
    i += 1;
  }

  return saida;
}

function ehTexto(valor) {
  const limpo = valor.trim();
  if (limpo.length < 2) return false;
  if (PERMITIDAS.has(limpo)) return false;
  if (!/\p{L}/u.test(limpo)) return false;
  for (const padrao of TECNICO) if (padrao.test(limpo)) return false;
  // Uma frase tem espaço ou acento. Uma palavra isolada sem acento é quase
  // sempre um identificador — e o custo de a deixar passar é menor do que o de
  // encher o portão de ruído que ninguém lê.
  return /\s/.test(limpo) || /[áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(limpo);
}

function linhaDe(fonte, indice) {
  return fonte.slice(0, indice).split("\n").length;
}

const achados = [];

for (const raiz of RAIZES) {
  for (const ficheiro of ficheiros(raiz)) {
    const relativo = relative(process.cwd(), ficheiro).split(sep).join("/");
    if (ISENTOS.has(relativo)) continue;

    const original = readFileSync(ficheiro, "utf8");
    const fonte = semComentarios(original);

    const registar = (valor, indice, tipo) => {
      if (!ehTexto(valor)) return;
      achados.push({
        ficheiro: relative(process.cwd(), ficheiro).split(sep).join("/"),
        linha: linhaDe(fonte, indice),
        texto: valor.trim().slice(0, 70),
        tipo,
      });
    };

    for (const m of fonte.matchAll(PROPS_VISIVEIS)) registar(m[2], m.index, "prop");
    for (const m of fonte.matchAll(TOAST)) registar(m[1], m.index, "toast");
    for (const m of fonte.matchAll(TEXTO_JSX)) registar(m[1], m.index, "jsx");
  }
}

if (achados.length === 0) {
  console.log("✓ i18n: nenhum texto visível escrito à mão");
  process.exit(0);
}

const porFicheiro = new Map();
for (const a of achados) {
  if (!porFicheiro.has(a.ficheiro)) porFicheiro.set(a.ficheiro, []);
  porFicheiro.get(a.ficheiro).push(a);
}

const ordenados = [...porFicheiro.entries()].sort((a, b) => b[1].length - a[1].length);

console.error(
  `✗ Texto visível escrito à mão (02 §12 · 07 §5.13): ${achados.length} em ${porFicheiro.size} ficheiros\n`,
);
/**
 * `--all` imprime todas as ocorrências e `--filter=<troço>` limita-as a um
 * caminho. Não é enfeite: é com isto que se traduz um ficheiro de cada vez,
 * sem ter de adivinhar o que está nas linhas que a lista corta.
 */
const TUDO = process.argv.includes("--all");
const FILTRO = process.argv.find((a) => a.startsWith("--filter="))?.slice(9);

for (const [ficheiro, lista] of ordenados) {
  if (FILTRO && !ficheiro.includes(FILTRO)) continue;
  console.error(`  ${String(lista.length).padStart(3)}  ${ficheiro}`);
  for (const a of TUDO ? lista : lista.slice(0, 3)) {
    console.error(`       ${a.linha}: ${JSON.stringify(a.texto)}`);
  }
  if (!TUDO && lista.length > 3) console.error(`       … mais ${lista.length - 3}`);
}

console.error("\nO texto que o utilizador lê vem de `packages/config/messages/*.json`,");
console.error("por `useTranslations` (cliente), `getTranslations` (servidor) ou");
console.error("por uma prop `labels` nos componentes de `@upm/ui`.");
process.exit(1);
