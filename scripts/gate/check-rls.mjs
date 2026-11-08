/**
 * Portão — a cerca do Postgres (12 §4.1, §4.2, §4.3, §5.2 · 02 §7.1)
 * ===========================================================================
 * Este portão existe por causa de um facto da arquitetura do UPM que é fácil
 * de esquecer e impossível de contornar: **o `NEXT_PUBLIC_SUPABASE_ANON_KEY`
 * está, por desenho, no browser de qualquer visitante**. Qualquer pessoa pode
 * falar diretamente com a base de dados — com `curl`, sem passar pelo Next,
 * sem passar por nenhum `middleware.ts`, sem passar por nenhuma Server Action.
 *
 * Nesse caminho, o que protege os dados é o RLS. Só o RLS. Uma tabela nova sem
 * `enable row level security` não dá erro, não parte compilação, não falha
 * teste nenhum: fica apenas legível para o mundo, em silêncio, até alguém
 * descobrir. É o defeito mais caro que esta base de dados sabe produzir e o
 * mais discreto a entrar.
 *
 * A 28 out 2026, a auditoria mediu 67 tabelas, 67 `enable row level security`,
 * 136 políticas, 254 funções `security definer` e **nenhuma** sem
 * `search_path`, e zero SQL dinâmico. Este portão não melhora esses números —
 * **impede que piorem**, que é tudo o que se pode pedir a um número que já
 * está certo. Com 93 migrações isto ainda se revê a olho; com 150 não.
 *
 * ## As seis regras
 *
 *  1. Toda a tabela criada em `public` tem RLS ativo.
 *  2. Toda a tabela com RLS tem ao menos uma política viva — RLS sem políticas
 *     fecha tudo, que é o mesmo bug ao contrário e igualmente silencioso.
 *  3. Uma política com `using (true)` declara-se com `-- rls-ok: <razão>`.
 *     Há casos legítimos (uma tabela de conteúdo público); o que não é
 *     legítimo é não se saber qual deles é.
 *  4. Toda a função `security definer` fixa o `search_path`. Sem isso, quem
 *     consiga criar um objeto num esquema do caminho de procura faz a função
 *     chamar código dele, com privilégios elevados. É a escalada clássica do
 *     Postgres.
 *  5. Nenhum `execute` dinâmico concatena com `||`. É a única porta por onde a
 *     injeção de SQL entra num sistema que, do lado do TypeScript, usa só
 *     consultas parametrizadas.
 *  6. Um `grant` ao papel `anon` sobre uma **tabela** está na allowlist aqui
 *     em baixo. Cada tabela que o `anon` não alcança é uma tabela que não tem
 *     de ser perfeitamente protegida por RLS.
 *
 * ## Porque é que os comentários são apagados primeiro
 *
 * Pela mesma razão do `check-responsive.mjs` e do `check-typography.mjs`, e
 * aqui com uma história: a primeira versão desta verificação, escrita à mão
 * durante a auditoria, acusou `set_updated_at` e `generate_ticket_ref` de
 * serem `security definer` sem `search_path`. Nenhuma das duas é `definer` —
 * as duas tinham, mais abaixo no ficheiro, um comentário em prosa com as
 * palavras "security definer". Esta base de dados documenta-se a si mesma com
 * muito texto, e um portão que leia o texto como se fosse código acusa o
 * inocente. Um portão que acusa o inocente é desligado em duas semanas, e
 * depois fica a dar verde — foi assim que o `gate:canvas` cegou.
 *
 * Correr sozinho:
 *   node scripts/gate/check-rls.mjs
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const RAIZ = process.env.UPM_RLS_RAIZ ?? ".";
const MIGRACOES = join(RAIZ, "supabase", "migrations");

/**
 * Tabelas que o papel `anon` pode alcançar, e porquê (regra 6).
 *
 * As duas que cá estão seguem o mesmo padrão, que é o correto: `revoke all` ao
 * `anon`, depois `grant select`, e uma política que decide linha a linha o que
 * é público. O `grant` abre a porta; a política é que diz o que está lá
 * dentro. Acrescentar uma entrada aqui é uma decisão de segurança — exige ler
 * a política da tabela, não só o `grant`.
 */
const TABELAS_PUBLICAS = new Set([
  // Conteúdo do site servido a visitantes anónimos. A política filtra por
  // `public` (ou `is_staff()`), por isso uma chave privada não sai daqui.
  "app_settings",
  // `launch_mode` tem de ser legível antes de haver sessão — é ele que decide
  // o que o site mostra. A política limita a leitura a essa chave.
  "feature_flags",
  // Termos e privacidade: a versão em vigor é lida por quem ainda não tem
  // conta, no ecrã de registo.
  "legal_documents",
  "legal_document_versions",
]);

/**
 * Tabelas com RLS e **zero** políticas, de propósito (regra 2).
 * ---------------------------------------------------------------------------
 * RLS ativo sem políticas nenhumas não é um esquecimento: é a configuração
 * mais fechada que o Postgres sabe fazer. Recusa tudo a todas as sessões, e
 * deixa de pé um só caminho — a `service_role`, que não passa por RLS. Para
 * uma tabela em que nenhuma sessão tem nada a fazer, é exatamente o que se
 * quer.
 *
 * O problema é que **selada e esquecida escrevem-se igual**. Daí esta lista:
 * não muda o comportamento da base de dados, obriga a dizer qual das duas é.
 *
 * Fica numa lista e não num comentário na migração (ao contrário da regra 3)
 * porque é uma decisão sobre a tabela inteira e porque se lê melhor toda de
 * uma vez: cinco tabelas às quais nenhuma sessão chega é uma afirmação sobre
 * a arquitetura, e quer-se vê-la num sítio só.
 */
const TABELAS_SELADAS = new Map([
  // Escrita só pelo webhook do Stripe, com `service_role`. 12 §7.1: as tabelas
  // de faturação não têm caminho de escrita a partir de sessão nenhuma.
  ["stripe_events", "só o webhook do Stripe escreve, com service_role"],
  // O pepper de derivação dos hashes de identidade. O comentário da própria
  // tabela di-lo: "Nunca legível por uma sessão."
  ["identity_secrets", "pepper de derivação (P9-07) — nunca legível por uma sessão"],
  // Identificador interno permanente por pessoa, só hashes HMAC. Sobrevive à
  // eliminação da conta, logo não pode pertencer a nenhuma sessão.
  ["person_identities", "hashes HMAC internos (P9-07), sobrevivem à conta"],
  ["offer_redemptions", "consumo de ofertas por identidade (P9-07), só service_role"],
  // Entregas de notificação: escreve o worker, lê o Admin por vista própria.
  ["notification_deliveries", "escrita pelo worker; a leitura passa por vista"],
]);

if (!existsSync(MIGRACOES)) {
  console.error(`✗ Não encontrei migrações em ${MIGRACOES}`);
  process.exit(1);
}

/** Apaga comentários mantendo os índices, para as linhas continuarem a bater. */
function semComentarios(texto) {
  const linhas = texto.split("\n");
  return linhas
    .map((linha) => {
      let dentroDeString = false;
      for (let i = 0; i < linha.length; i++) {
        const c = linha[i];
        if (c === "'") {
          dentroDeString = !dentroDeString;
          continue;
        }
        // `--` fora de string começa comentário: o resto da linha é espaço.
        if (!dentroDeString && c === "-" && linha[i + 1] === "-") {
          return linha.slice(0, i) + " ".repeat(linha.length - i);
        }
      }
      return linha;
    })
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));
}

const linhaDe = (texto, indice) => texto.slice(0, indice).split("\n").length;

/** `public.foo`, `"foo"`, `only public.foo` → `foo`. Outro esquema → null. */
function nomeSimples(bruto) {
  const limpo = bruto.replace(/"/g, "").trim();
  if (!limpo.includes(".")) return limpo;
  const [esquema, tabela] = limpo.split(".");
  return esquema === "public" ? tabela : null;
}

const ficheiros = readdirSync(MIGRACOES)
  .filter((f) => f.endsWith(".sql"))
  .sort();

/** Estado acumulado pelas migrações, por ordem — como o Postgres as aplica. */
const tabelas = new Map(); // nome → { ficheiro, rls: bool, politicas: Set }
const semSearchPath = [];
const sqlDinamico = [];
const usingTrue = [];
const grantsAnon = [];

for (const ficheiro of ficheiros) {
  const bruto = readFileSync(join(MIGRACOES, ficheiro), "utf8");
  const sql = semComentarios(bruto);

  /**
   * As instruções aplicam-se **pela ordem do documento**, como o Postgres as
   * aplica — e não uma regra de cada vez, de uma ponta à outra do ficheiro.
   *
   * Não é preciosismo: a primeira versão deste portão passava por todos os
   * `create policy` e só depois por todos os `drop policy`, e as migrações
   * desta base escrevem rotineiramente `drop policy X` seguido de
   * `create policy X` para a substituir. Lida fora de ordem, a substituição
   * aparecia como uma eliminação: o portão acusou oito tabelas de terem RLS
   * sem políticas, e todas as oito tinham políticas. Um portão que inverte a
   * ordem das instruções está a avaliar uma base de dados que não existe.
   */
  const eventos = [];
  const juntar = (regex, tipo) => {
    for (const m of sql.matchAll(regex)) eventos.push({ i: m.index, tipo, m });
  };

  juntar(
    /create\s+(?:unlogged\s+)?table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_."]+)/gi,
    "tabela+",
  );
  juntar(/drop\s+table\s+(?:if\s+exists\s+)?([a-zA-Z0-9_."]+)/gi, "tabela-");
  juntar(
    /alter\s+table\s+(?:only\s+)?([a-zA-Z0-9_."]+)\s+enable\s+row\s+level\s+security/gi,
    "rls+",
  );
  juntar(
    /create\s+policy\s+("?[a-zA-Z0-9_]+"?)\s+on\s+([a-zA-Z0-9_."]+)([\s\S]*?);/gi,
    "politica+",
  );
  juntar(
    /drop\s+policy\s+(?:if\s+exists\s+)?("?[a-zA-Z0-9_]+"?)\s+on\s+([a-zA-Z0-9_."]+)/gi,
    "politica-",
  );

  eventos.sort((a, b) => a.i - b.i);

  for (const { tipo, m, i } of eventos) {
    if (tipo === "tabela+") {
      const nome = nomeSimples(m[1]);
      if (nome && !tabelas.has(nome)) {
        tabelas.set(nome, { ficheiro, rls: false, politicas: new Map() });
      }
      continue;
    }
    if (tipo === "tabela-") {
      const nome = nomeSimples(m[1]);
      if (nome) tabelas.delete(nome);
      continue;
    }
    if (tipo === "rls+") {
      const alvo = nomeSimples(m[1]) && tabelas.get(nomeSimples(m[1]));
      if (alvo) alvo.rls = true;
      continue;
    }
    if (tipo === "politica-") {
      const alvo = nomeSimples(m[2]) && tabelas.get(nomeSimples(m[2]));
      if (alvo) alvo.politicas.delete(m[1].replace(/"/g, ""));
      continue;
    }

    // politica+
    const politica = m[1].replace(/"/g, "");
    const nome = nomeSimples(m[2]);
    const alvo = nome && tabelas.get(nome);
    if (!alvo) continue;

    /**
     * Regra 3 — `using (true)` tem de ser uma decisão declarada, e julga-se
     * no **estado final**, como as regras 1 e 2.
     *
     * Importa porque uma política é rotineiramente substituída por outra mais
     * estreita: a `feature_flags_select` nasceu em `base.sql` com
     * `using (true)` e passou, em `20261002130300`, a
     * `key = 'launch_mode' or is_staff()`. Acusar a primeira é acusar
     * história já corrigida — e um portão que obriga a justificar o que já
     * foi arranjado ensina a ignorá-lo.
     *
     * A dispensa procura-se no texto ORIGINAL (com comentários), que é onde
     * ela vive.
     */
    const linha = linhaDe(sql, i);
    const vizinhanca = bruto
      .split("\n")
      .slice(Math.max(0, linha - 8), linha + 2)
      .join("\n");

    alvo.politicas.set(politica, {
      aberta: /\b(?:using|with\s+check)\s*\(\s*true\s*\)/i.test(m[3]),
      declarada: /rls-ok:/i.test(vizinhanca),
      local: `${ficheiro}:${linha}`,
      tabela: nome,
    });
  }

  // --- Regra 4: `security definer` sem `search_path` ----------------------
  //
  // Lê-se só o CABEÇALHO: da declaração até ao `$$` que abre o corpo. É aí que
  // `security definer` e `set search_path` têm de estar, e é o que evita o
  // falso positivo descrito no topo deste ficheiro.
  for (const m of sql.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+([a-zA-Z0-9_."]+)\s*\(/gi,
  )) {
    const resto = sql.slice(m.index, m.index + 6000);
    const abertura = /\$[a-zA-Z0-9_]*\$/.exec(resto);
    if (!abertura) continue;
    const cabecalho = resto.slice(0, abertura.index);
    if (!/security\s+definer/i.test(cabecalho)) continue;
    if (!/search_path/i.test(cabecalho)) {
      semSearchPath.push(`${ficheiro}:${linhaDe(sql, m.index)}  ${m[1]}`);
    }
  }

  // --- Regra 5: SQL dinâmico com concatenação ----------------------------
  for (const m of sql.matchAll(/\bexecute\b[^;]*?\|\|/gi)) {
    sqlDinamico.push(`${ficheiro}:${linhaDe(sql, m.index)}`);
  }

  // --- Regra 6: `grant` a `anon` sobre tabela ----------------------------
  //
  // `grant execute on function … to anon` é outra coisa e não entra aqui: uma
  // função é uma porta estreita, com argumentos e um corpo que valida; uma
  // tabela é a sala toda.
  for (const m of sql.matchAll(
    /grant\s+([a-z, ]+?)\s+on\s+(?:table\s+)?([a-zA-Z0-9_."]+)\s+to\s+([^;]+);/gi,
  )) {
    if (/function|procedure|routine|schema|sequence|all\s+tables/i.test(m[0])) continue;
    if (!/\banon\b/i.test(m[3])) continue;
    const nome = nomeSimples(m[2]);
    if (!nome || TABELAS_PUBLICAS.has(nome)) continue;
    grantsAnon.push(`${ficheiro}:${linhaDe(sql, m.index)}  ${m[1].trim()} em \`${nome}\``);
  }
}

const semRls = [];
const semPolitica = [];
for (const [nome, estado] of tabelas) {
  if (!estado.rls) {
    semRls.push(`${estado.ficheiro}  tabela \`${nome}\``);
    continue;
  }
  if (estado.politicas.size === 0 && !TABELAS_SELADAS.has(nome)) {
    semPolitica.push(`${estado.ficheiro}  tabela \`${nome}\``);
  }
  for (const [politica, p] of estado.politicas) {
    if (p.aberta && !p.declarada) {
      usingTrue.push(`${p.local}  política \`${politica}\` em \`${p.tabela}\``);
    }
  }
}

const falhas =
  semRls.length +
  semPolitica.length +
  usingTrue.length +
  semSearchPath.length +
  sqlDinamico.length +
  grantsAnon.length;

if (falhas === 0) {
  const comRls = [...tabelas.values()].filter((t) => t.rls).length;
  const politicas = [...tabelas.values()].reduce((n, t) => n + t.politicas.size, 0);
  console.log(
    `✓ Cerca do Postgres: ${tabelas.size} tabelas, ${comRls} com RLS, ${politicas} políticas, ` +
      `sem \`definer\` solto, sem SQL dinâmico`,
  );
  process.exit(0);
}

if (semRls.length > 0) {
  console.error("✗ Tabela em `public` sem RLS (12 §4.1):\n");
  for (const hit of semRls) console.error(`      ${hit}`);
  console.error("\n  A `anon key` está no browser de qualquer visitante: sem RLS, esta tabela");
  console.error("  lê-se com um `curl`, sem sessão e sem passar pelo Next. Acrescente");
  console.error("  `alter table public.<tabela> enable row level security;` e as políticas.\n");
}

if (semPolitica.length > 0) {
  console.error("✗ Tabela com RLS e nenhuma política viva (12 §4.1):\n");
  for (const hit of semPolitica) console.error(`      ${hit}`);
  console.error("\n  RLS sem políticas recusa tudo, a todos — inclusive ao dono dos dados. É o");
  console.error("  mesmo defeito ao contrário, e tão silencioso quanto: ninguém vê um erro,");
  console.error("  só uma lista sempre vazia.\n");
}

if (usingTrue.length > 0) {
  console.error("✗ Política com `using (true)` sem razão declarada (12 §4.1):\n");
  for (const hit of usingTrue) console.error(`      ${hit}`);
  console.error("\n  `using (true)` abre a tabela a quem alcançar o papel. Há casos legítimos");
  console.error("  — conteúdo público, uma tabela de referência. O que não é legítimo é não");
  console.error("  se saber qual. Escreva `-- rls-ok: <razão>` nas linhas acima da política.\n");
}

if (semSearchPath.length > 0) {
  console.error("✗ Função `security definer` sem `search_path` fixo (12 §4.3):\n");
  for (const hit of semSearchPath) console.error(`      ${hit}`);
  console.error("\n  Uma função `definer` corre com os privilégios de quem a criou. Sem");
  console.error("  `set search_path = ''`, quem consiga criar um objeto num esquema do");
  console.error("  caminho de procura faz a função chamar código dele, elevado. Eram 254");
  console.error("  funções e nenhuma assim — esta seria a primeira.\n");
}

if (sqlDinamico.length > 0) {
  console.error("✗ `execute` dinâmico com concatenação `||` (12 §5.2):\n");
  for (const hit of sqlDinamico) console.error(`      ${hit}`);
  console.error("\n  É a única porta de injeção de SQL que resta num sistema que, do lado do");
  console.error("  TypeScript, só usa consultas parametrizadas. Use `format('%I', …)` para");
  console.error("  identificadores, `format('%L', …)` para valores, ou `execute … using`.\n");
}

if (grantsAnon.length > 0) {
  console.error("✗ `grant` ao papel `anon` sobre uma tabela fora da allowlist (12 §2.1):\n");
  for (const hit of grantsAnon) console.error(`      ${hit}`);
  console.error("\n  Cada tabela que o `anon` não alcança é uma tabela que não tem de ser");
  console.error("  perfeitamente protegida por RLS. Se este acesso é mesmo necessário,");
  console.error("  acrescente a tabela a `TABELAS_PUBLICAS` em `check-rls.mjs` com a razão");
  console.error("  escrita — e leia a política dela antes, não só o `grant`.\n");
}

process.exit(1);
