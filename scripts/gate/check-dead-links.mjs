import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Portão das ligações mortas — um `href` que não leva a lado nenhum
 * ===========================================================================
 * Nasce de um defeito concreto, a 27 out 2026: na demonstração da home, os
 * doze itens do menu da plataforma eram `<a href="#">`. Parecia inofensivo —
 * "o menu é decorativo, não leva a lado nenhum" — e não era: **um `#` é uma
 * navegação**. O browser resolve-o para o início do documento e salta para lá.
 * Quem clicava em "Leads" dentro da demonstração era atirado para o topo do
 * site público, e isso em todos os itens, nos dois perfis.
 *
 * O que torna este defeito difícil de ver é não haver sintoma nenhum no
 * código: compila, passa no ESLint, não há erro de consola, e o elemento
 * desenha-se exatamente como se queria. Só se vê a usar — e a secção onde
 * vivia é a que diz "navegue pelo painel real da plataforma".
 *
 * ## A regra
 *
 * Um `href` serve para ir a um sítio. Se o elemento não vai a sítio nenhum,
 * não é uma ligação: é um **botão**, e `<button>` é o elemento que existe para
 * isso. Ganha-se o teclado e o leitor de ecrã de graça, e perde-se o salto.
 *
 * Marcam-se três escritas da mesma coisa:
 *
 *  - `href="#"` — salta para o topo do documento;
 *  - `href=""` — **recarrega a página**, que é ainda pior;
 *  - `href="javascript:void(0)"` — além de morto, é bloqueado pela CSP do
 *    projeto (`script-src 'self' 'nonce-…'`), portanto nem sequer funciona
 *    como o truque que pretende ser.
 *
 * As três contam tanto no JSX (`href="#"`) como dentro de um objeto
 * (`{ href: "#" }`) — e é esta segunda que importa, porque foi onde o defeito
 * esteve: numa fixture, longe do JSX que a desenha.
 *
 * **Uma âncora a sério não é isto.** `href="#seccao"` leva a um sítio da
 * página e passa; o que se marca é o `#` sozinho.
 *
 * ## O que não conta
 *
 * Comentários. Esta nota escreve `href="#"` várias vezes e não é defeito
 * nenhum — foi o primeiro erro da varredura de i18n e não se repete aqui.
 *
 * Corre-se à mão com `pnpm gate:links`, e o teste negativo que o vigia é
 * `pnpm gate:links:test` — um portão só se confia depois de o ver recusar.
 */

/** A raiz é substituível para o teste negativo poder montar um repo falso. */
const RAIZ = process.env.UPM_LINKS_RAIZ ?? process.cwd();

const DIRETORIOS = [
  "apps/web/src",
  "apps/app/src",
  "apps/interno/src",
  "packages/ui/src",
  "packages/cloud/src",
];

const IGNORAR_PASTAS = new Set(["node_modules", ".next", "dist"]);

/**
 * Os três padrões, com a razão de cada um na mensagem.
 *
 * O `=` cobre o JSX (`href="#"`, `href={"#"}`) e o `:` cobre o objeto
 * (`{ href: "#" }`), que é por onde o defeito entrou.
 */
const PADROES = [
  {
    id: "topo",
    regex: /\bhref\s*[:=]\s*\{?\s*"#"/g,
    titulo: '`href="#"` — salta para o topo da página',
  },
  {
    id: "recarrega",
    regex: /\bhref\s*[:=]\s*\{?\s*""/g,
    titulo: '`href=""` — recarrega a página',
  },
  {
    id: "javascript",
    regex: /\bhref\s*[:=]\s*\{?\s*"javascript:/g,
    titulo: '`href="javascript:…"` — morto e bloqueado pela CSP',
  },
];

/** Tira comentários, preservando as quebras para as linhas baterem certo. */
function semComentarios(fonte) {
  let saida = "";
  let i = 0;

  while (i < fonte.length) {
    const c = fonte[i];
    const prox = fonte[i + 1];

    if (c === "/" && prox === "/") {
      while (i < fonte.length && fonte[i] !== "\n") i += 1;
      continue;
    }

    if (c === "/" && prox === "*") {
      i += 2;
      while (i < fonte.length && !(fonte[i] === "*" && fonte[i + 1] === "/")) {
        if (fonte[i] === "\n") saida += "\n";
        i += 1;
      }
      i += 2;
      continue;
    }

    if (c === '"' || c === "'" || c === "`") {
      saida += c;
      i += 1;
      while (i < fonte.length) {
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

function ficheiros(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORAR_PASTAS.has(entrada.name)) continue;
    const completo = join(dir, entrada.name);
    if (entrada.isDirectory()) ficheiros(completo, out);
    else if (/\.tsx?$/.test(entrada.name) && !/\.(test|spec)\.tsx?$/.test(entrada.name)) {
      out.push(completo);
    }
  }
  return out;
}

const achados = [];

for (const diretorio of DIRETORIOS) {
  for (const ficheiro of ficheiros(join(RAIZ, diretorio))) {
    const fonte = semComentarios(readFileSync(ficheiro, "utf8"));
    const relativo = relative(RAIZ, ficheiro).split(sep).join("/");

    for (const padrao of PADROES) {
      padrao.regex.lastIndex = 0;
      for (const m of fonte.matchAll(padrao.regex)) {
        const linha = fonte.slice(0, m.index).split("\n").length;
        achados.push({ tipo: padrao.id, titulo: padrao.titulo, ficheiro: relativo, linha });
      }
    }
  }
}

if (achados.length === 0) {
  console.log("✓ Ligações: nenhum `href` que não leve a lado nenhum");
  process.exit(0);
}

console.error(`✗ Ligações mortas: ${achados.length}\n`);

for (const padrao of PADROES) {
  const deste = achados.filter((a) => a.tipo === padrao.id);
  if (deste.length === 0) continue;
  console.error(`  ${padrao.titulo}`);
  for (const a of deste) console.error(`      ${a.ficheiro}:${a.linha}`);
  console.error("");
}

console.error("  Um `href` serve para ir a um sítio. Um elemento que não vai a sítio nenhum");
console.error('  é um `<button type="button">` com `onClick` — ganha teclado e leitor de');
console.error("  ecrã de graça, e não atira o visitante para o topo da página.");
console.error('  Uma âncora a sério (`href="#precos"`) passa; o que se marca é o `#` só.\n');
process.exit(1);
