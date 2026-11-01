import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

/**
 * Portão dos canvases — as storyboards montam os componentes de hoje
 * ===========================================================================
 * As storyboards do Tempo renderizam os componentes **de produção**, com os
 * dados a entrar por prop. É isso que as torna úteis — e é isso que as faz
 * apodrecer em silêncio: quando um componente ganha uma prop obrigatória, a
 * storyboard que o monta deixa de compilar, e ninguém reparava.
 *
 * ## O que isto apanhou no dia em que nasceu
 *
 * 20 out 2026, primeira corrida: **12 erros em 7 ficheiros**. Nenhum era
 * teórico:
 *
 *  - `legal/Contrato.tsx` importava `../proprietario/NoNavigation`, e a pasta
 *    passou a chamar-se `06 - proprietario` na renomeação dos canvases. O
 *    canvas Legal estava **partido**.
 *  - A storyboard da Caixa de e-mail não passava `onAttachmentLink` nem
 *    `onAttachmentToCloud` — os anexos de D66 chegaram ao ecrã depois dela.
 *  - A do Plano estava uma fase atrás: passava um `trial` que já não existe e
 *    faltavam-lhe os quatro campos que a Fase 9 acrescentou ao `PlanStatus`.
 *  - `demoMarket.ts` tinha preferências de notificação para `lead` e
 *    `contract`, que **nunca foram tipos de notificação**.
 *
 * Quatro ciclos de deriva, num sítio onde o único sinal era abrir o canvas e
 * ver um ecrã em branco.
 *
 * ## Porque é um `tsc` e não um portão próprio
 *
 * Porque a pergunta é literalmente "isto ainda compila contra os componentes
 * de hoje", e o `tsc` do sidecar responde-lhe melhor do que qualquer regex. O
 * `tempo/` tem o seu próprio `tsconfig.json`, que inclui `designs/**`, e o seu
 * próprio TypeScript em `node_modules` — o `pnpm typecheck` do monorepo **não**
 * passa por aqui, porque o sidecar não é um workspace (ver a nota de
 * `tempo/package.json`).
 *
 * Corre-se com o TypeScript do sidecar e não com o da raiz de propósito: é o
 * que o devserver do canvas usa, e um portão que compila com outra versão
 * responde a uma pergunta diferente da que importa.
 */

/**
 * ---------------------------------------------------------------------------
 * O PORTÃO ESTEVE CEGO, E ERA UM CARÁTER (21 out 2026)
 * ---------------------------------------------------------------------------
 * `TSC` era um caminho **relativo** (`tempo/node_modules/...`) e o `spawnSync`
 * corre com `cwd: "tempo"`. O Node procurava-o em `tempo/tempo/node_modules/`,
 * não o encontrava, e morria antes de compilar o que fosse. O que saía era um
 * `Error: Cannot find module` no stderr — e esse texto **não contém
 * `error TS`**, que é o que o filtro abaixo procura. Zero linhas filtradas,
 * zero erros, portão verde.
 *
 * Verde a dizer "as storyboards compilam", sem nunca ter compilado nada. É
 * precisamente a falha que este ficheiro existe para impedir, com o portão
 * dela própria a ser a vítima — e explica porque a migração das rotas para
 * `app/[locale]/` partiu dois canvases sem o portão dizer nada.
 *
 * Absoluto desde agora. E, para que isto não se repita em silêncio: **a
 * ausência de erros deixou de bastar**. Se o `tsc` não arrancar — qualquer
 * saída diferente de zero sem uma única linha de `error TS` — o portão falha e
 * diz que falhou a arrancar, em vez de dar o verde por omissão.
 */
const SIDECAR = resolve("tempo");
const TSC = resolve(SIDECAR, "node_modules", "typescript", "bin", "tsc");

if (!existsSync(resolve(SIDECAR, "tsconfig.json"))) {
  console.log("✓ canvas: não há sidecar `tempo/` neste checkout — nada a verificar");
  process.exit(0);
}

if (!existsSync(TSC)) {
  console.error(
    "✗ canvas: falta o TypeScript do sidecar. Corra `pnpm install` dentro de `tempo/`.",
  );
  process.exit(1);
}

const resultado = spawnSync(process.execPath, [TSC, "--noEmit", "--pretty", "false"], {
  cwd: SIDECAR,
  encoding: "utf8",
});

const saida = `${resultado.stdout ?? ""}${resultado.stderr ?? ""}`;

/**
 * O host gerado, e o único erro que se perdoa por ele faltar
 * ---------------------------------------------------------------------------
 * `main.tsx` e `app/tempo-host/page.tsx` importam `.tempo/tempo-host`, que o
 * Tempo gera na máquina de quem tem a app aberta e que o `.gitignore` deixa de
 * fora. No CI não existe, e o `tsc` dizia "Cannot find module" sobre ele —
 * desde 27 out o `main` estava vermelho por isto, sem nenhuma storyboard
 * partida. Perdoa-se **esse** erro (TS2307 sobre esse módulo) e **só** quando
 * o ficheiro falta mesmo; qualquer outro erro, inclusive noutro módulo em
 * falta, continua a parar o portão. Onde o host existe, nada muda.
 */
const HOST_GERADO = ["tsx", "ts"].some((ext) =>
  existsSync(resolve(SIDECAR, ".tempo", `tempo-host.${ext}`)),
);
const doHostGerado = (linha) =>
  linha.includes("error TS2307") && /'(?:\.\.?\/)+\.tempo\/tempo-host'/.test(linha);

const erros = saida
  .split("\n")
  .filter((linha) => linha.includes("error TS"))
  .filter((linha) => HOST_GERADO || !doHostGerado(linha));

// O `tsc` não arrancou: saiu com erro e não disse uma única coisa sobre tipos.
// Sem este ramo, é exatamente aqui que o portão dava o verde por omissão.
if (erros.length === 0 && resultado.status !== 0) {
  console.error("✗ canvas: o `tsc` do sidecar não arrancou — o portão não verificou nada.\n");
  console.error(saida.trim().split("\n").slice(0, 10).join("\n"));
  process.exit(1);
}

if (erros.length === 0) {
  console.log("✓ canvas: as storyboards compilam contra os componentes de hoje");
  process.exit(0);
}

const ficheiros = new Set(erros.map((linha) => linha.split("(")[0]));
console.error(
  `✗ Storyboards fora de sincronia com os componentes: ${erros.length} em ${ficheiros.size} ficheiros\n`,
);
for (const linha of erros) console.error(`  ${linha}`);
console.error("\nUma storyboard monta o componente de produção: quando ele ganha uma prop");
console.error("obrigatória, é aqui que se acrescenta — nos dados, nunca na marcação.");
process.exit(1);
