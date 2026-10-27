/**
 * Teste negativo do portão das ligações mortas.
 *
 * Pela mesma lição do teste da tipografia: um portão que nunca falhou e um
 * portão que não sabe falhar dizem o mesmo na consola. A única diferença
 * observável é vê-lo recusar o que devia recusar — e, no fim, aceitar um
 * repositório são, sem o que um portão que recusasse tudo passaria aqui.
 *
 *   node scripts/gate/check-dead-links.test.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PORTAO = join(dirname(fileURLToPath(import.meta.url)), "check-dead-links.mjs");

function montar(ficheiros) {
  const raiz = mkdtempSync(join(tmpdir(), "upm-links-"));
  for (const [caminho, conteudo] of Object.entries(ficheiros)) {
    const destino = join(raiz, caminho);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, conteudo);
  }
  return raiz;
}

function correr(raiz) {
  const r = spawnSync(process.execPath, [PORTAO], {
    env: { ...process.env, UPM_LINKS_RAIZ: raiz },
    encoding: "utf8",
  });
  return { codigo: r.status, saida: (r.stdout ?? "") + (r.stderr ?? "") };
}

const CASOS = [
  {
    nome: "âncora vazia em JSX",
    ficheiros: { "apps/web/src/mau.tsx": 'const A = <a href="#">Leads</a>;' },
    esperado: /salta para o topo/,
  },
  {
    // O caso real: o `#` não estava no JSX, estava na fixture que o alimenta.
    nome: "âncora vazia dentro de um objeto",
    ficheiros: {
      "packages/ui/src/demo.tsx": 'export const NAV = [{ id: "painel", href: "#" }];',
    },
    esperado: /salta para o topo/,
  },
  {
    nome: "href vazio",
    ficheiros: { "apps/app/src/mau.tsx": 'const A = <a href="">Voltar</a>;' },
    esperado: /recarrega a página/,
  },
  {
    nome: "javascript: no href",
    ficheiros: {
      "apps/interno/src/mau.tsx": 'const A = <a href="javascript:void(0)">x</a>;',
    },
    esperado: /bloqueado pela CSP/,
  },
];

const SAO = {
  // Uma âncora a sério, um botão e um `#` dentro de um comentário: nenhum é defeito.
  "apps/web/src/bom.tsx": [
    'export const Precos = () => <a href="#precos">Preços</a>;',
    'export const Menu = () => <button type="button" onClick={abrir}>Leads</button>;',
    '// Antes isto era `href="#"`, que saltava para o topo.',
    "",
  ].join("\n"),
  "packages/ui/src/bom.tsx": 'export const NAV = [{ id: "painel", href: "/painel" }];',
};

let falhou = false;

for (const caso of CASOS) {
  const raiz = montar({ ...SAO, ...caso.ficheiros });
  const { codigo, saida } = correr(raiz);
  rmSync(raiz, { recursive: true, force: true });

  if (codigo === 1 && caso.esperado.test(saida)) {
    console.log(`✓ recusa: ${caso.nome}`);
    continue;
  }
  falhou = true;
  console.error(`✗ NÃO recusou: ${caso.nome}  (saiu com ${codigo})`);
  console.error(
    saida
      .split("\n")
      .map((l) => "      " + l)
      .join("\n"),
  );
}

{
  const raiz = montar(SAO);
  const { codigo, saida } = correr(raiz);
  rmSync(raiz, { recursive: true, force: true });
  if (codigo === 0) {
    console.log("✓ aceita: âncora verdadeira, botão e comentário");
  } else {
    falhou = true;
    console.error(`✗ recusou um repositório são (saiu com ${codigo})`);
    console.error(
      saida
        .split("\n")
        .map((l) => "      " + l)
        .join("\n"),
    );
  }
}

if (falhou) {
  console.error("\n  O portão das ligações não distingue o que devia. Não confie nele.\n");
  process.exit(1);
}
