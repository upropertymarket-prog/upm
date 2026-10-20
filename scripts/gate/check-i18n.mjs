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
 * 4. Valores de objeto: `{ header: "Ações" }`, `{ label: "Compra e venda" }`,
 *    um `Record<string, string>` de rótulos.
 * 5. Os pedaços fixos de um template literal: `` `Transferir ${row.name}` ``.
 *
 * Os dois últimos entraram a **19 out 2026**, e a razão é o próprio número: o
 * portão marcava 20 strings no `CloudScreen` e havia lá perto de 40 em
 * português. A primeira versão só via JSX e props — e neste produto quase todo
 * o texto está em colunas de tabela e em listas de opções, isto é, dentro de
 * objetos. Era o erro de forma do `messages.test.ts` outra vez, uma camada
 * acima: um portão a medir parte do problema e a dar confiança pelo todo. Com
 * eles, a conta passou de 272 para 504 — não houve regressão nenhuma, apenas
 * deixou de haver ponto cego.
 *
 * Varre-se também **`.ts`** e, com a restrição de `RAIZES`, `packages/db`: um
 * `Record` de rótulos não deixa de ser texto visível por o ficheiro não ter
 * JSX, e o `SHARE_PERMISSION_LABELS` ("Pode ver") vivia no pacote da base de
 * dados.
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
 * - **Mensagens de server action**, que são **D73**: contam-se e imprimem-se à
 *   parte, nunca somadas ao total. Ver a nota de `paraD73` — a correção delas é
 *   outra (`getTranslations` dentro das actions, i18n do `zod`), e um portão
 *   que mistura duas dívidas não serve para fechar nenhuma.
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

/**
 * Onde se procura. `soRotulos` existe por uma razão só: `packages/db` tem
 * texto de duas naturezas misturado no mesmo ficheiro — rótulos de UI (o
 * `SHARE_PERMISSION_LABELS` que lá estava até 19 out) e mensagens de
 * validação do `zod`. Os primeiros são defeito desta dívida; as segundas são
 * **D73** (precisam de `getTranslations` dentro das actions e da i18n do
 * próprio zod) e contá-las aqui era pôr no mesmo saco duas correções com
 * caminhos diferentes. Nessas raízes só se olha para valores de objeto, e as
 * linhas de uma cadeia `z.` ficam de fora.
 */
const RAIZES = [
  { dir: "apps/web/src" },
  { dir: "apps/app/src" },
  { dir: "apps/interno/src" },
  { dir: "packages/ui/src" },
  { dir: "packages/db/src", soRotulos: true },
];

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
 * `chave: "frase"` — um valor de objeto.
 *
 * Acrescentado a 19 out 2026, depois de o `CloudScreen` ter mostrado o
 * tamanho do ponto cego: o portão marcava-lhe 20 strings e havia perto de 40
 * em português. A diferença estava quase toda aqui — `{ header: "Ações" }`
 * numa coluna de tabela, `{ label: "Compra e venda" }` numa lista de opções,
 * um `Record<string, string>` de rótulos. Neste produto quase todos os ecrãs
 * montam tabelas e selects, logo quase todo o texto vivia onde não se olhava.
 *
 * **A chave não entra na decisão, só o valor.** Um `Record` de rótulos tem
 * chaves que são o domínio (`view`, `share_created`), não nomes de props, e
 * filtrar por uma lista de chaves deixava-o passar outra vez. Quem decide é o
 * `ehTexto` — e foi por isso que ele ganhou as regras de CSS: é este padrão
 * que vê os objetos de `style`.
 */
const VALOR_EM_OBJETO = /(?:^|[{,[(\s])([A-Za-z_$][\w$]*)\s*:\s*"([^"\n]+)"/g;

/**
 * Template literal: `` `Transferir ${row.name}` ``. Olha-se para os pedaços
 * fixos, que é onde está a frase; o que vem de `${}` é dado e não texto.
 * Um pedaço tem de ter duas letras seguidas para contar — assim `" · "` e
 * `"/mês"` não enchem a lista, mas "Transferir " conta.
 */
const TEMPLATE = /`([^`\\]*)`/g;

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
  /^#[0-9a-f]{3,8}$/i,
  /^\d+(\.\d+)?(px|rem|em|%|fr|vh|vw|s|ms)?$/,
  /^[\s\p{P}\p{S}]+$/u, // só pontuação ou símbolos
  /^(noopener|noreferrer|_blank|_self|true|false|null|undefined)$/,
  /^[a-z-]+(\s+[a-z-]+)*$/, // lista de classes ou de valores, tudo minúsculo

  /**
   * CSS. Vieram com o padrão dos valores de objeto (19 out): um objeto de
   * `style` é um objeto como outro qualquer, e `padding: "0 var(--sp-3)"` tem
   * espaço como uma frase tem. Reconhece-se pela função, pela unidade ou por
   * ser só números e pontuação — não pelo nome da propriedade, que num
   * `Record` de rótulos não ajuda.
   */
  /(?:var|calc|minmax|repeat|rgba?|hsla?|url|translate[XYZ]?|rotate|scale|cubic-bezier|linear-gradient|clamp|fit-content)\(/,
  /(?:^|\s)-?\d+(\.\d+)?(px|rem|em|%|fr|vh|vw|dvh|ch|s|ms)(\s|$|,|\))/,
  /^[\d\s.,;:()%+/*-]+$/, // só números e pontuação
  // pilha de tipos de letra: `Arial, Helvetica, sans-serif`
  /^["']?[A-Za-z][\w -]*["']?(,\s*["']?[A-Za-z][\w -]*["']?)+$/,
  // valores de atalho do CSS: `0 0 auto`, `1px solid`, `none`
  /^-?[\d.\s]*(auto|none|inherit|initial|unset|solid|dashed|hidden|nowrap|ellipsis)(\s|$)/,

  /**
   * Pedaços de HTML e de CSS escritos à mão. Vêm dos construtores de e-mail,
   * que montam o corpo com `<style>` embutido porque é o que os clientes de
   * correio desenham — e o `!important` de uma folha de estilos não é texto
   * que alguém leia. A frase do e-mail conta; a folha de estilos não.
   */
  /!important|<\/[a-z]|<!doctype|<(html|head|body|style|meta|br|p|a|hr|img|div|span|table|td|tr)[\s/>]/i,
  /^[\s;}]*[a-z-]+\s*:\s*[^;]+;/, // declaração de CSS
  /\{[^}]*[a-z-]+\s*:[^}]*(;|\})/, // bloco de CSS: `blockquote{margin:0;…}`
  /^,\s*\w+(\s*,\s*\w+)+$/, // lista de colunas de um `select`
  /**
   * Classes utilitárias: tudo minúsculo e **pelo menos uma** palavra
   * hifenizada (`flex w-full items-center rounded-xl`). O hífen é o que
   * distingue — sem essa exigência, "12 meses" e "no seu portefólio" caíam
   * aqui. O preço é deixar passar uma frase minúscula com hífen, que em
   * português quase sempre leva acento e volta pela outra porta.
   */
  /^(?=[a-z0-9:[\]/.%\s-]*-)[a-z0-9:[\]/.%-]+(\s+[a-z0-9:[\]/.%-]+)*$/,
  /^var\s|document\.|window\.|localStorage/, // script embutido no `<head>`
];

/**
 * Pedaços de JSX que o padrão do texto apanha mas não são frases: expressão a
 * meio, fragmento de código, atributo. Vale a pena tê-los em separado dos
 * técnicos porque a razão é outra — ali é "não se traduz", aqui é "não é
 * sequer texto".
 */
const NAO_E_FRASE = [/&&|\|\||=>|[=!<>]=|\?\s*\(|\$\{/, /^\s*[a-z]+\s*[?:]/i];

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

/** @type {(dir: string, out?: string[]) => string[]} */
function ficheiros(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR_PASTAS.has(entrada.name)) continue;
    const completo = join(dir, entrada.name);
    if (entrada.isDirectory()) ficheiros(completo, out);
    // `.ts` também, desde 19 out: os rótulos de estado e os formatos de data
    // vivem em ficheiros `…Types.ts`, e um `Record` de rótulos não deixa de
    // ser texto visível por o ficheiro não ter JSX.
    else if (/\.tsx?$/.test(entrada.name) && !/\.(test|spec)\.tsx?$/.test(entrada.name))
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
  for (const padrao of NAO_E_FRASE) if (padrao.test(limpo)) return false;
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

/**
 * O que é de D73 e não desta dívida — contado em separado, nunca somado.
 *
 * Um módulo de server action não pode usar `useTranslations`: corre no
 * servidor, e as frases que devolve (`return { error: "Sessão inválida." }`)
 * chegam ao ecrã tal e qual. A correção existe — `getTranslations` — mas é
 * outra: muda a assinatura das actions, e parte das mensagens vem do `zod`,
 * que tem o seu próprio caminho de internacionalização. Decisão do cliente a
 * 19 out 2026: fica para D73.
 *
 * Contar aqui era deixar o número de D72 subir com trabalho que não lhe
 * pertence — e um portão que mistura duas dívidas não serve para fechar
 * nenhuma. Imprime-se o total à parte, para não voltar a ser ponto cego.
 */
const paraD73 = [];

/** Um módulo que corre no servidor declara-o na primeira linha. */
function ehServerAction(fonte, caminho) {
  return /^\s*["']use server["']/.test(fonte) || /\/actions?(\/|\.ts$)/.test(caminho);
}

/** A linha onde um índice cai, inteira — para a guarda do `z.` das raízes só-rótulos. */
function linhaInteira(fonte, indice) {
  const antes = fonte.lastIndexOf("\n", indice) + 1;
  const depois = fonte.indexOf("\n", indice);
  return fonte.slice(antes, depois === -1 ? undefined : depois);
}

for (const raiz of RAIZES) {
  for (const ficheiro of ficheiros(raiz.dir)) {
    const relativo = relative(process.cwd(), ficheiro).split(sep).join("/");
    if (ISENTOS.has(relativo)) continue;

    const original = readFileSync(ficheiro, "utf8");
    const fonte = semComentarios(original);
    const servidor = ehServerAction(original, relativo);

    const registar = (valor, indice, tipo, chave) => {
      if (!ehTexto(valor)) return;
      // Ver a nota de `RAIZES`: numa raiz só-rótulos, uma frase na linha de
      // uma cadeia `z.` é mensagem de validação, e essa é D73. A chave
      // `message` entra pela mesma porta: num `.refine({ message, path })` a
      // frase fica numa linha só dela, sem o `z.` à vista — e `message` é o
      // nome que o zod lhe dá, não um rótulo de interface.
      if (raiz.soRotulos && (/\bz\./.test(linhaInteira(fonte, indice)) || chave === "message")) {
        paraD73.push({
          ficheiro: relativo,
          linha: linhaDe(fonte, indice),
          texto: valor.trim().slice(0, 70),
          tipo,
        });
        return;
      }
      (servidor ? paraD73 : achados).push({
        ficheiro: relativo,
        linha: linhaDe(fonte, indice),
        texto: valor.trim().slice(0, 70),
        tipo,
      });
    };

    for (const m of fonte.matchAll(VALOR_EM_OBJETO)) registar(m[2], m.index, "objeto", m[1]);
    if (raiz.soRotulos) continue;

    for (const m of fonte.matchAll(PROPS_VISIVEIS)) registar(m[2], m.index, "prop");
    for (const m of fonte.matchAll(TOAST)) registar(m[1], m.index, "toast");
    for (const m of fonte.matchAll(TEXTO_JSX)) registar(m[1], m.index, "jsx");
    for (const m of fonte.matchAll(TEMPLATE)) {
      // Só os pedaços fixos: o que vem de `${}` é dado.
      for (const pedaco of m[1].split(/\$\{[^}]*\}/)) {
        if (/\p{L}\p{L}/u.test(pedaco)) registar(pedaco, m.index, "template");
      }
    }
  }
}

/** O que fica para D73, resumido em duas linhas. Nunca soma ao total. */
function notaD73() {
  if (paraD73.length === 0) return;
  const ficheiros = new Set(paraD73.map((a) => a.ficheiro)).size;
  console.error(
    `\nℹ Fora desta conta, para D73: ${paraD73.length} mensagens em ${ficheiros} módulos de\n` +
      `  server action. Correm no servidor, pedem \`getTranslations\` e parte vem do \`zod\` —\n` +
      `  outra correção. Ver \`--d73\` para a lista.`,
  );
}

const TUDO = process.argv.includes("--all");
const FILTRO = process.argv.find((a) => a.startsWith("--filter="))?.slice(9);
const SO_D73 = process.argv.includes("--d73");

if (SO_D73) {
  const porModulo = new Map();
  for (const a of paraD73) porModulo.set(a.ficheiro, [...(porModulo.get(a.ficheiro) ?? []), a]);
  console.error(
    `D73 — mensagens de server action: ${paraD73.length} em ${porModulo.size} módulos\n`,
  );
  for (const [ficheiro, lista] of [...porModulo].sort((a, b) => b[1].length - a[1].length)) {
    if (FILTRO && !ficheiro.includes(FILTRO)) continue;
    console.error(`  ${String(lista.length).padStart(3)}  ${ficheiro}`);
    for (const a of TUDO ? lista : lista.slice(0, 3))
      console.error(`       ${a.linha}: ${JSON.stringify(a.texto)}`);
    if (!TUDO && lista.length > 3) console.error(`       … mais ${lista.length - 3}`);
  }
  process.exit(0);
}

if (achados.length === 0) {
  console.log("✓ i18n: nenhum texto visível escrito à mão");
  notaD73();
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
 * caminho — é com isto que se traduz um ficheiro de cada vez, sem adivinhar o
 * que está nas linhas que a lista corta. `--d73` troca a lista pela das
 * mensagens de server action, que não entram nesta conta.
 */
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
notaD73();
process.exit(1);
