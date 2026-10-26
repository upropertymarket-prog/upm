/**
 * Teste negativo do portão da tipografia.
 *
 * Existe por uma lição cara: o `gate:canvas` esteve cego durante semanas e
 * ninguém reparou, porque um portão que nunca falhou e um portão que não sabe
 * falhar dizem exatamente a mesma coisa na consola. A única diferença
 * observável é vê-lo recusar um caso que devia recusar.
 *
 * Cada caso monta um repositório mínimo numa pasta temporária, aponta-lhe o
 * portão pela `UPM_TIPOGRAFIA_RAIZ` e exige duas coisas: que saia com código 1
 * e que a mensagem diga qual das cinco regras foi violada. O caso de controlo
 * no fim monta o mesmo repositório **sem** violações e exige que passe — sem
 * ele, um portão que recusasse tudo passaria neste teste.
 *
 *   node scripts/gate/check-typography.test.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PORTAO = join(dirname(fileURLToPath(import.meta.url)), "check-typography.mjs");

/** O mínimo que o portão precisa de encontrar para considerar o repo são. */
const BASE = {
  "packages/ui/src/styles/tokens.css": [
    ":root {",
    "  --fw-regular: 400;",
    "  --fw-medium: 500;",
    "  --fw-semibold: 600;",
    "  --fw-bold: 700;",
    "}",
  ].join("\n"),
  "packages/ui/src/styles/components.css": [
    "h1,",
    "h2,",
    "h3 {",
    "  font-weight: var(--fw-bold);",
    "}",
  ].join("\n"),
  "apps/web/src/ok.tsx":
    'export const A = () => <b style={{ fontWeight: "var(--fw-semibold)" }} />;',
};

function montar(ficheiros) {
  const raiz = mkdtempSync(join(tmpdir(), "upm-tipografia-"));
  for (const [caminho, conteudo] of Object.entries(ficheiros)) {
    const destino = join(raiz, caminho);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, conteudo);
  }
  return raiz;
}

function correr(raiz) {
  const r = spawnSync(process.execPath, [PORTAO], {
    env: { ...process.env, UPM_TIPOGRAFIA_RAIZ: raiz },
    encoding: "utf8",
  });
  return { codigo: r.status, saida: (r.stdout ?? "") + (r.stderr ?? "") };
}

const CASOS = [
  {
    nome: "peso a literal em JSX",
    ficheiros: { "apps/web/src/mau.tsx": "const A = <b style={{ fontWeight: 700 }} />;" },
    esperado: /literal em JSX/,
  },
  {
    nome: "peso a literal em CSS",
    ficheiros: { "apps/web/src/mau.css": ".x { font-weight: 700; }" },
    esperado: /literal em CSS/,
  },
  {
    nome: "token acima do teto",
    ficheiros: {
      "packages/ui/src/styles/tokens.css": BASE["packages/ui/src/styles/tokens.css"].replace(
        "}",
        "  --fw-black: 800;\n}",
      ),
    },
    esperado: /acima de 700/,
  },
  {
    nome: "classe font-extrabold do Tailwind",
    ficheiros: { "apps/web/src/mau.tsx": 'const A = <b className="font-extrabold" />;' },
    esperado: /Classe do Tailwind/,
  },
  {
    nome: "regra de cabeçalho removida",
    ficheiros: { "packages/ui/src/styles/components.css": ".upm-btn { color: red; }" },
    esperado: /já não declara o peso de h1–h3/,
  },
];

let falhou = false;

for (const caso of CASOS) {
  const raiz = montar({ ...BASE, ...caso.ficheiros });
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

// Controlo: sem o verde, um portão que recusasse tudo passava nos cinco casos.
{
  const raiz = montar(BASE);
  const { codigo, saida } = correr(raiz);
  rmSync(raiz, { recursive: true, force: true });
  if (codigo === 0) {
    console.log("✓ aceita: repositório sem violações");
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
  console.error("\n  O portão da tipografia não distingue o que devia. Não confie nele.\n");
  process.exit(1);
}
console.log("\n✓ O portão da tipografia recusa as cinco violações e aceita o resto");
