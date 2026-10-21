/**
 * Medidor de rolo horizontal — 02 §13 (360 px → 1920 px)
 * =========================================================================
 * Abre cada storyboard do canvas num Chrome headless, à largura pedida, e
 * pergunta à própria página uma coisa só: há alguma coisa mais larga do que o
 * ecrã? Se houver, diz *qual* elemento — um booleano não se corrige.
 *
 * As storyboards montam os componentes de produção com dados fixos, por isso
 * isto mede os ecrãs verdadeiros sem precisar de Supabase nem de sessão.
 *
 *   node scripts/audit-responsive.mjs [largura]
 *
 * Precisa do host dos canvases a correr (a app Tempo já o levanta).
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const WIDTH = Number(process.argv[2] ?? 360);
const HEIGHT = 900;
const HOST = process.env.TEMPO_HOST ?? "http://127.0.0.1:60737";
const PORT = 9333;

/** Storyboard por ecrã — a lista cobre as três apps. */
const SCREENS = [
  // Proprietário, pela ordem da sidebar (07 §4.3) — a mesma do canvas.
  ["canvases/06 - proprietario", "Painel"],
  ["canvases/06 - proprietario", "MarketClaro"],
  ["canvases/06 - proprietario", "DetalheClaro"],
  ["canvases/06 - proprietario", "PropriedadesClaro"],
  ["canvases/06 - proprietario", "NovaPropriedadeClaro"],
  ["canvases/06 - proprietario", "Leads"],
  ["canvases/06 - proprietario", "Mensagens"],
  ["canvases/06 - proprietario", "Agenda"],
  ["canvases/06 - proprietario", "MapaClaro"],
  ["canvases/06 - proprietario", "CloudClaro"],
  ["canvases/06 - proprietario", "ContratosClaro"],
  ["canvases/06 - proprietario", "Plano"],
  ["canvases/06 - proprietario", "DefinicoesClaro"],
  ["canvases/03 - admin", "AdminDashboardClaro"],
  ["canvases/03 - admin", "AdminUtilizadoresClaro"],
  ["canvases/03 - admin", "AdminModeracaoClaro"],
  ["canvases/03 - admin", "AdminTrafegoClaro"],
  ["canvases/03 - admin", "AdminPlanosClaro"],
  ["canvases/03 - admin", "AdminContratosClaro"],
  ["canvases/03 - admin", "AdminLeadsClaro"],
  ["canvases/03 - admin", "AdminDefinicoesClaro"],
  ["canvases/02 - autenticacao", "EntrarClaro"],
  ["canvases/02 - autenticacao", "CriarContaClaro"],
  ["canvases/02 - autenticacao", "VerificacaoClaro"],
  ["canvases/02 - autenticacao", "PlanoClaro"],
  ["canvases/02 - autenticacao", "PedirRecuperacaoClaro"],
  ["canvases/02 - autenticacao", "NovaPalavraPasseClaro"],
  // O Marketing (P10-07 a P10-10), acrescentado a 21 out 2026 — a área nasceu
  // depois desta lista e nunca tinha sido medida.
  ["canvases/05 - marketing", "MarketingAtualizacoesClaro"],
  ["canvases/05 - marketing", "MarketingCampanhasClaro"],
  ["canvases/05 - marketing", "MarketingCampanhasAgendamentoFalhado"],
  ["canvases/05 - marketing", "MarketingMetricasClaro"],
  ["canvases/05 - marketing", "MarketingCloudClaro"],
  ["canvases/home", "Home"],
];

const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find((p) => existsSync(p));

if (!CHROME) {
  console.error("Sem Chrome nem Edge instalados.");
  process.exit(1);
}

/**
 * Corre dentro da página. Devolve os elementos que passam da direita do ecrã.
 *
 * `right > width + 1` e não `> width`: um arredondamento de meio pixel numa
 * borda não é um ecrã partido, e sem a folga toda a página acusava.
 */
const PROBE = `(() => {
  const w = document.documentElement.clientWidth;
  const bad = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right <= w + 1 && r.left >= -1) continue;
    // Só interessa quem *causa* o transbordo, não quem o herda: se o pai já
    // transborda, o filho é consequência.
    const p = el.parentElement;
    if (p) {
      const pr = p.getBoundingClientRect();
      if (pr.right > w + 1 || pr.left < -1) continue;
      // Um pai que rola de lado é a solução, não o problema (tabelas, calendário).
      const ov = getComputedStyle(p).overflowX;
      if (ov === "auto" || ov === "scroll" || ov === "hidden") continue;
    }
    bad.push({
      tag: el.tagName.toLowerCase(),
      cls: (typeof el.className === "string" ? el.className : "").slice(0, 60),
      left: Math.round(r.left),
      right: Math.round(r.right),
    });
  }
  return JSON.stringify({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: w,
    offenders: bad.slice(0, 6),
  });
})()`;

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--user-data-dir=" + process.env.TEMP + "/upm-responsive-audit",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function target() {
  for (let i = 0; i < 40; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page");
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
    } catch {
      /* ainda a arrancar */
    }
    await sleep(250);
  }
  throw new Error("O Chrome headless não abriu a porta de depuração.");
}

const ws = new WebSocket(await target());
await new Promise((r) => (ws.onopen = r));

let seq = 0;
const waiting = new Map();
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && waiting.has(msg.id)) {
    waiting.get(msg.id)(msg.result);
    waiting.delete(msg.id);
  }
};
const send = (method, params = {}) =>
  new Promise((resolve) => {
    const id = ++seq;
    waiting.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });

await send("Page.enable");
await send("Emulation.setDeviceMetricsOverride", {
  width: WIDTH,
  height: HEIGHT,
  deviceScaleFactor: 1,
  mobile: true,
});

let failures = 0;
console.log(`\nRolo horizontal a ${WIDTH} px\n${"=".repeat(46)}`);

for (const [canvas, storyboard] of SCREENS) {
  const path = `tempo/designs/${canvas}/index.canvas.tsx`;
  const url =
    `${HOST}/tempo-host?canvasPath=${encodeURIComponent(path)}` +
    `&storyboardId=${storyboard}&width=${WIDTH}&height=${HEIGHT}`;

  await send("Page.navigate", { url });
  // O host monta o componente depois do load; sem esta pausa mede-se o vazio.
  await sleep(2600);

  const res = await send("Runtime.evaluate", { expression: PROBE, returnByValue: true });
  const out = JSON.parse(res?.result?.value ?? '{"offenders":[],"scrollWidth":0,"clientWidth":1}');
  const over = out.scrollWidth - out.clientWidth;

  // Uma página vazia não tem rolo horizontal — e era assim que os URLs
  // partidos pela renomeação das pastas passavam no silêncio.
  if (out.clientWidth <= 1 || out.scrollWidth === 0) {
    failures++;
    console.log(`\n  VAZIA  ${storyboard}  — a storyboard não carregou (host ou caminho errado)`);
  } else if (over > 1) {
    failures++;
    console.log(`\n  FALHA  ${storyboard}  (+${over} px)`);
    for (const o of out.offenders) {
      console.log(`         <${o.tag} class="${o.cls}">  ${o.left} → ${o.right}`);
    }
  } else {
    console.log(`  ok     ${storyboard}`);
  }
}

console.log(
  `\n${"=".repeat(46)}\n${SCREENS.length - failures}/${SCREENS.length} ecrãs sem rolo horizontal.\n`,
);

ws.close();
chrome.kill();
process.exit(failures > 0 ? 1 : 0);
