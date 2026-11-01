/**
 * Teste negativo do `gate:canvas` — a decisão, com saídas de `tsc` à mão
 * ===========================================================================
 * O portão em si corre o `tsc` do sidecar, que demora e depende do estado da
 * máquina; o que tem de ser provado é a **decisão**: que perdoa o import do
 * host gerado quando ele falta, e nada mais. As duas primeiras linhas de
 * `SAIDA_CI` são exatamente as que o CI escreveu a 1 nov 2026.
 *
 * O caso que ficou para a história é o terceiro de `CASOS`: com os dois erros
 * perdoados e o `tsc` a sair com 2, a primeira versão do perdão declarava que
 * o `tsc` "não arrancou". Foi o CI que o apanhou, não um teste — por isso
 * este teste existe.
 *
 * Correr sozinho:
 *   node scripts/gate/check-canvas.test.mjs
 */
import { decidir } from "./canvas-decisao.mjs";

const SAIDA_CI = [
  "app/tempo-host/page.tsx(5,40): error TS2307: Cannot find module '../../.tempo/tempo-host' or its corresponding type declarations.",
  "main.tsx(5,23): error TS2307: Cannot find module './.tempo/tempo-host' or its corresponding type declarations.",
].join("\n");
const PROP_EM_FALTA =
  "designs/canvases/x/Card.tsx(12,5): error TS2741: Property 'label' is missing in type '{}'.";
const OUTRO_MODULO =
  "designs/canvases/x/Card.tsx(1,20): error TS2307: Cannot find module '@upm/ui/Novo'.";
const OUTRO_DO_TEMPO = "main.tsx(6,1): error TS2307: Cannot find module './.tempo/outro'.";

const CASOS = [
  // [nome, saída, status, host gerado, { naoArrancou, erros }]
  ["tudo limpo", "", 0, true, { naoArrancou: false, erros: 0 }],
  [
    "o tsc não arrancou de todo",
    "Error: Cannot find tsconfig",
    1,
    true,
    { naoArrancou: true, erros: 0 },
  ],
  [
    "CI sem host: os dois imports perdoados, verde",
    SAIDA_CI,
    2,
    false,
    { naoArrancou: false, erros: 0 },
  ],
  ["com host, os mesmos erros contam", SAIDA_CI, 2, true, { naoArrancou: false, erros: 2 }],
  [
    "CI sem host + uma storyboard partida: recusa",
    `${SAIDA_CI}\n${PROP_EM_FALTA}`,
    2,
    false,
    { naoArrancou: false, erros: 1 },
  ],
  ["outro módulo em falta não se perdoa", OUTRO_MODULO, 2, false, { naoArrancou: false, erros: 1 }],
  [
    "outro ficheiro de .tempo não se perdoa",
    OUTRO_DO_TEMPO,
    2,
    false,
    { naoArrancou: false, erros: 1 },
  ],
];

let falhou = false;
for (const [nome, saida, status, host, esperado] of CASOS) {
  const r = decidir(saida, status, host);
  const certo = r.naoArrancou === esperado.naoArrancou && r.erros.length === esperado.erros;
  if (certo) {
    console.log(`✓ ${nome}`);
    continue;
  }
  falhou = true;
  console.error(
    `✗ ${nome}: naoArrancou=${r.naoArrancou} erros=${r.erros.length}, esperado naoArrancou=${esperado.naoArrancou} erros=${esperado.erros}`,
  );
}

if (falhou) {
  console.error("\n  O portão dos canvases não decide o que devia. Não confie nele.\n");
  process.exit(1);
}
console.log(`\n✓ O portão dos canvases decide certo em ${CASOS.length} casos`);
