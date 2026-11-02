/**
 * Portão — a fronteira do servidor (12 §4.2, §5.3, §9.3)
 * ===========================================================================
 * Três coisas que, cada uma à sua maneira, atravessam a fronteira entre o que
 * é nosso e o que sai para fora. Nenhuma das três parte compilação, nenhuma
 * falha teste, e as três só se descobrem a ler o diff com atenção — que é
 * precisamente o que deixa de acontecer quando o repositório cresce.
 *
 *  1. **`service_role` fora da sua allowlist.** A `SUPABASE_SERVICE_ROLE_KEY`
 *     ignora **todo** o RLS. Um único uso dela num caminho alcançável pelo
 *     utilizador, com um identificador vindo do pedido, é acesso total à base
 *     de dados — e anula, nesse caminho, as 67 políticas de `check-rls.mjs`.
 *     O `gate:bundle` já impede que a chave chegue ao cliente; este portão
 *     impede que ela se espalhe pelo servidor.
 *
 *  2. **`console.log` em código de app.** O `sendDefaultPii: false` do Sentry
 *     trava o que o Sentry apanha sozinho; não trava o que nós lhe damos. Um
 *     `console.log` de um objeto de lead põe nome, e-mail e telefone no log do
 *     alojamento e, por via dos integradores, no Sentry — que é um
 *     subprocessador, com outra retenção. É a fuga de dados pessoais mais
 *     comum que existe, e a mais fácil de escrever sem pensar.
 *
 *  3. **`dangerouslySetInnerHTML` sem dizer quem sanitizou.** Os seis usos
 *     atuais são todos legítimos — JSON-LD gerado por nós, HTML já passado
 *     pelo `sanitize-html` na escrita. O sétimo é que preocupa. Escrever a
 *     origem ao lado custa uma linha e é o que distingue "já foi sanitizado"
 *     de "ninguém se lembrou".
 *
 * As três allowlists abaixo têm razões escritas, não só caminhos. Uma
 * allowlist sem razões é uma lista de exceções que ninguém ousa mexer.
 *
 * Correr sozinho:
 *   node scripts/gate/check-server-boundary.mjs
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

const RAIZ = process.env.UPM_FRONTEIRA_RAIZ ?? ".";

/** Normaliza para `/`, para as allowlists se escreverem uma vez só. */
const norm = (p) => p.split(sep).join("/");

/**
 * Onde a chave que ignora o RLS pode aparecer, e porquê.
 * ---------------------------------------------------------------------------
 * Acrescentar uma entrada aqui é uma decisão de segurança, não arrumação. A
 * pergunta a responder antes de a escrever é sempre a mesma: **este caminho
 * recebe um identificador do pedido e usa-o sem confirmar o dono?** Se sim,
 * não é uma entrada na allowlist, é um bug.
 */
const SERVICE_ROLE_PERMITIDO = new Map([
  ["packages/db/src/server.ts", "a fábrica: é aqui que `createServiceClient` existe"],
  ["packages/db/src/stripe.ts", "a fábrica do lado do Stripe"],
  [
    "apps/app/src/app/api/stripe/webhook/route.ts",
    "autentica-se pela assinatura antes de ler o corpo; as tabelas de faturação não têm caminho de escrita a partir de sessão nenhuma",
  ],
  [
    "apps/interno/src/app/actions/step-up.ts",
    "reautenticação: operação de autenticação, por natureza acima do RLS",
  ],
  ["apps/interno/src/app/actions/auth.ts", "entrada no interno, pela mesma razão do step-up"],
  [
    "apps/interno/src/app/admin/planos/actions.ts",
    "catálogo de planos: escreve o que o Stripe espelha, sem sessão a que pertença",
  ],
  [
    "packages/e2e/lib/ambiente.ts",
    "E2E (A5): cria e apaga as contas de teste de cada corrida; corre só num terminal, nunca atende um pedido — a mesma natureza dos `*.test.ts`, que este portão já não varre",
  ],
  [
    "apps/interno/src/app/admin/definicoes/page.tsx",
    "NÃO cria cliente: só lê se a variável está definida, para o painel de saúde da configuração",
  ],
  [
    "apps/app/src/app/actions/account.ts",
    "eliminação e exportação de conta (P9-06): anonimiza o perfil, que nenhuma sessão pode fazer a si mesma",
  ],
  [
    "apps/web/src/app/[locale]/criar-conta/actions.ts",
    "`signup_eligibility` com entradas validadas por zod; ainda não há sessão nesta altura",
  ],
  [
    "apps/web/src/app/[locale]/pre-inscricao/actions.ts",
    "enfileira a confirmação por e-mail com valores derivados no servidor (o `recipient` vem do RPC, não do pedido)",
  ],
  // O worker não atende pedidos: é um processo de fundo, sem utilizador.
  ["apps/mail-worker/src/env.ts", "worker: processo de fundo, sem sessão"],
  ["apps/mail-worker/src/supabase.ts", "worker: o cliente dele"],
  ["apps/mail-worker/src/index.ts", "worker: o arranque"],
]);

/**
 * `console.log` permitido. A lista é curta de propósito.
 */
const CONSOLE_PERMITIDO = new Map([
  [
    "apps/mail-worker/src/index.ts",
    "é o logger do worker: a linha já foi composta e filtrada acima",
  ],
]);

/**
 * Pastas varridas. `scripts/` fica de fora do service_role de propósito: são
 * ferramentas de operador, corridas à mão num terminal, que não atendem
 * pedido nenhum — `import-daily.ts` e `sync-catalog.ts` existem para isso.
 */
const AREAS = ["apps", "packages"];

function recolher(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    const nome = entrada.name;
    // `.next-e2e` é a pasta de build dos servidores dos E2E: código gerado.
    if (["node_modules", ".next", ".next-e2e", "dist", "build"].includes(nome)) continue;
    const cheio = join(dir, nome);
    if (entrada.isDirectory()) recolher(cheio, out);
    else if (/\.(tsx?|mts|cts)$/.test(nome) && !/\.test\.(tsx?)$/.test(nome)) out.push(cheio);
  }
  return out;
}

const blank = (m) => m.replace(/[^\n]/g, " ");
const semComentarios = (t) =>
  t.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/^[ \t]*\/\/[^\n]*/gm, blank);

const linhaDe = (texto, i) => texto.slice(0, i).split("\n").length;

const servicoSolto = [];
const logsSoltos = [];
const htmlSemOrigem = [];

for (const area of AREAS) {
  for (const ficheiro of recolher(join(RAIZ, area))) {
    const caminho = norm(relative(RAIZ, ficheiro));
    const bruto = readFileSync(ficheiro, "utf8");
    const codigo = semComentarios(bruto);

    // --- Regra 1 ---------------------------------------------------------
    const usaServico = /\bcreateServiceClient\b|SUPABASE_SERVICE_ROLE_KEY/.test(codigo);
    if (usaServico && !SERVICE_ROLE_PERMITIDO.has(caminho)) {
      const m = /\bcreateServiceClient\b|SUPABASE_SERVICE_ROLE_KEY/.exec(codigo);
      servicoSolto.push(`${caminho}:${linhaDe(codigo, m.index)}`);
    }

    // --- Regra 2 ---------------------------------------------------------
    if (!CONSOLE_PERMITIDO.has(caminho)) {
      for (const m of codigo.matchAll(/\bconsole\.log\s*\(/g)) {
        logsSoltos.push(`${caminho}:${linhaDe(codigo, m.index)}`);
      }
    }

    // --- Regra 3 ---------------------------------------------------------
    //
    // A dispensa procura-se no texto ORIGINAL, com comentários: é lá que ela
    // vive. Oito linhas acima chegam para a nota caber antes do JSX.
    for (const m of codigo.matchAll(/dangerouslySetInnerHTML/g)) {
      const linha = linhaDe(codigo, m.index);
      const vizinhanca = bruto
        .split("\n")
        .slice(Math.max(0, linha - 9), linha + 1)
        .join("\n");
      if (!/html-ok:/i.test(vizinhanca)) htmlSemOrigem.push(`${caminho}:${linha}`);
    }
  }
}

const falhas = servicoSolto.length + logsSoltos.length + htmlSemOrigem.length;

if (falhas === 0) {
  console.log(
    `✓ Fronteira do servidor: ${SERVICE_ROLE_PERMITIDO.size} usos de \`service_role\` declarados, ` +
      "sem `console.log` solto, HTML em bruto com origem",
  );
  process.exit(0);
}

if (servicoSolto.length > 0) {
  console.error("✗ `service_role` fora da allowlist (12 §4.2):\n");
  for (const hit of servicoSolto) console.error(`      ${hit}`);
  console.error("\n  Esta chave ignora TODO o RLS: neste ficheiro, as 67 políticas do");
  console.error("  `gate:rls` deixam de valer. Antes de a acrescentar a");
  console.error("  `SERVICE_ROLE_PERMITIDO` em `check-server-boundary.mjs`, responda: este");
  console.error("  caminho recebe um identificador do pedido e usa-o sem confirmar o dono?");
  console.error("  Se sim, não é uma exceção — é um bug. Quase sempre o que se quer é o");
  console.error("  cliente da sessão (`createClient`), que passa por RLS.\n");
}

if (logsSoltos.length > 0) {
  console.error("✗ `console.log` em código de app (12 §9.3):\n");
  for (const hit of logsSoltos) console.error(`      ${hit}`);
  console.error("\n  O log do alojamento é lido por integradores e chega ao Sentry, que é um");
  console.error("  subprocessador com outra retenção. Um objeto de lead ou de perfil leva");
  console.error("  nome, e-mail e telefone lá dentro. Use `console.error` com uma mensagem");
  console.error("  (sem o objeto) ou `Sentry.captureException`.\n");
}

if (htmlSemOrigem.length > 0) {
  console.error("✗ `dangerouslySetInnerHTML` sem origem declarada (12 §5.3):\n");
  for (const hit of htmlSemOrigem) console.error(`      ${hit}`);
  console.error("\n  Os usos legítimos desta base são todos a mesma coisa: HTML que nós");
  console.error("  geramos, ou HTML já passado pelo `sanitize-html` NA ESCRITA (ver");
  console.error("  `packages/db/src/signatures.ts`). Escreva `// html-ok: <de onde vem e");
  console.error("  quem o sanitizou>` nas linhas acima. Sanitizar na leitura é tarde: a");
  console.error("  linha já estava gravada e o próximo a lê-la pode não passar por aqui.\n");
}

process.exit(1);
