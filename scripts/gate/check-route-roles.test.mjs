/**
 * Teste negativo do portão das rotas por papel.
 *
 * Pela lição do `gate:canvas`. Com uma particularidade própria deste portão:
 * ele lê as listas de prefixos **da fonte do middleware**, e portanto tem de
 * se comportar bem quando essa fonte muda de forma. O caso
 * "middleware sem as listas" existe para garantir que, nesse dia, o portão diz
 * que não as encontrou em vez de dar verde por não ter nada com que comparar —
 * que é a forma mais insidiosa de um portão cegar.
 *
 *   node scripts/gate/check-route-roles.test.mjs
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PORTAO = join(dirname(fileURLToPath(import.meta.url)), "check-route-roles.mjs");

const MW_APP = [
  'const OWNER_ONLY_PREFIXES = ["/propriedades", "/leads", "/agenda"];',
  'const BUYER_ONLY_PREFIXES = ["/guardados", "/meus-pedidos"];',
  'const PUBLIC_PREFIXES = ["/partilha", "/conta-suspensa"];',
  'const NO_SUBSCRIPTION_PREFIXES = ["/plano", "/definicoes", "/api"];',
  "export function middleware() {}",
].join("\n");

const MW_INTERNO = [
  "const AREA_PREFIX = {",
  '  "/admin": "admin",',
  '  "/suporte": "support",',
  '  "/marketing": "marketing",',
  "} as const;",
  "export function middleware() {",
  '  const publicPaths = ["/entrar", "/verificar-2fa"];',
  "  return publicPaths;",
  "}",
].join("\n");

/** Um repositório mínimo são: uma rota por prefixo e uma que lê o papel. */
const BASE = {
  "apps/app/src/middleware.ts": MW_APP,
  "apps/interno/src/middleware.ts": MW_INTERNO,
  "apps/app/src/app/page.tsx": "export default function Raiz() { return null; }",
  "apps/app/src/app/propriedades/page.tsx": "export default function P() { return null; }",
  "apps/app/src/app/painel/page.tsx": [
    "export default async function Painel() {",
    "  const role = await lerPapel();",
    '  if (role === "buyer") return <Comprador />;',
    "  return <Proprietario />;",
    "}",
  ].join("\n"),
  "apps/interno/src/app/admin/painel/page.tsx": "export default function A() { return null; }",
  "apps/interno/src/app/entrar/page.tsx": "export default function E() { return null; }",
  "apps/interno/src/app/page.tsx": "export default function R() { return null; }",
  "apps/interno/src/app/configurar-2fa/page.tsx": "export default function C() { return null; }",
  "apps/interno/src/app/verificar-2fa/page.tsx": "export default function V() { return null; }",
  "apps/interno/src/app/definicoes/seguranca/page.tsx": "export default function S() { return null; }",
};

function montar(ficheiros) {
  const raiz = mkdtempSync(join(tmpdir(), "upm-rotas-"));
  for (const [caminho, conteudo] of Object.entries(ficheiros)) {
    const destino = join(raiz, caminho);
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, conteudo);
  }
  return raiz;
}

function correr(raiz) {
  const r = spawnSync(process.execPath, [PORTAO], {
    env: { ...process.env, UPM_ROTAS_RAIZ: raiz },
    encoding: "utf8",
  });
  return { codigo: r.status, saida: (r.stdout ?? "") + (r.stderr ?? "") };
}

const CASOS_RECUSA = [
  {
    nome: "rota nova no app, sem prefixo e sem ler o papel",
    ficheiros: {
      "apps/app/src/app/relatorios/page.tsx":
        "export default function Relatorios() { return <Tabela />; }",
    },
    esperado: /sem papel decidido/,
  },
  {
    nome: "rota nova do interno fora das três áreas",
    ficheiros: {
      "apps/interno/src/app/auditoria/page.tsx":
        "export default function Auditoria() { return null; }",
    },
    esperado: /fora das três áreas/,
  },
  {
    nome: "middleware do app sem as listas de prefixos",
    ficheiros: {
      "apps/app/src/middleware.ts": "export function middleware() {}",
    },
    esperado: /Não consegui ler as listas/,
  },
  {
    nome: "middleware do interno sem AREA_PREFIX",
    ficheiros: {
      "apps/interno/src/middleware.ts": "export function middleware() {}",
    },
    esperado: /Não consegui ler as áreas/,
  },
];

const CASOS_ACEITA = [
  { nome: "controlo: repositório são", ficheiros: {} },
  {
    nome: "rota nova debaixo de um prefixo de proprietário",
    ficheiros: {
      "apps/app/src/app/propriedades/[id]/visitas/page.tsx":
        "export default function V() { return null; }",
    },
  },
  {
    nome: "rota nova partilhada que lê o papel na página",
    ficheiros: {
      "apps/app/src/app/mensagens/page.tsx": [
        "export default async function Mensagens() {",
        "  const { role } = await perfil();",
        '  return <Lista modo={role === "owner" ? "recebidas" : "enviadas"} />;',
        "}",
      ].join("\n"),
    },
  },
  {
    nome: "grupo de rotas (…) não conta para o URL",
    ficheiros: {
      "apps/app/src/app/(painel)/propriedades/novo/page.tsx":
        "export default function N() { return null; }",
    },
  },
  {
    nome: "rota nova do interno dentro de uma área",
    ficheiros: {
      "apps/interno/src/app/marketing/newsletters/page.tsx":
        "export default function N() { return null; }",
    },
  },
];

let falhou = false;

for (const caso of CASOS_RECUSA) {
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

for (const caso of CASOS_ACEITA) {
  const raiz = montar({ ...BASE, ...caso.ficheiros });
  const { codigo, saida } = correr(raiz);
  rmSync(raiz, { recursive: true, force: true });
  if (codigo === 0) {
    console.log(`✓ aceita: ${caso.nome}`);
    continue;
  }
  falhou = true;
  console.error(`✗ recusou o que devia aceitar: ${caso.nome}  (saiu com ${codigo})`);
  console.error(
    saida
      .split("\n")
      .map((l) => "      " + l)
      .join("\n"),
  );
}

if (falhou) {
  console.error("\n  O portão das rotas por papel não distingue o que devia. Não confie nele.\n");
  process.exit(1);
}
console.log(
  `\n✓ As rotas por papel recusam ${CASOS_RECUSA.length} violações e aceitam ${CASOS_ACEITA.length} padrões legítimos`,
);
