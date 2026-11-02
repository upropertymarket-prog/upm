/**
 * Portão — nenhuma rota sem papel decidido (12 §12.4 · 07 §4.2, §4.3, §24.6)
 * ===========================================================================
 * Os três `middleware.ts` guardam as rotas **por prefixo**, a partir de listas
 * escritas à mão: `OWNER_ONLY_PREFIXES`, `BUYER_ONLY_PREFIXES`, `AREA_PREFIX`.
 * O mecanismo é bom e a falha dele é sempre a mesma: **uma rota nova que
 * ninguém acrescentou à lista**. Não dá erro, não parte compilação, não falha
 * teste — simplesmente fica alcançável por quem não devia, e descobre-se
 * quando um comprador abre `/leads` e vê os contactos de outra pessoa.
 *
 * É falha por omissão, e a omissão não aparece em diff nenhum: o diff mostra
 * o ficheiro novo que foi acrescentado, não a linha que não foi escrita.
 *
 * ## As duas formas legítimas de decidir o papel
 *
 * Esta base de dados usa as duas, e as duas estão certas:
 *
 *  1. **Por prefixo, no middleware** — quando a rota é de um papel só.
 *     `/propriedades` é do proprietário e de mais ninguém.
 *  2. **Na própria página** — quando a rota serve os dois papéis com conteúdo
 *     diferente. `/painel` é o exemplo que o próprio middleware comenta: saiu
 *     da lista de proprietário quando o Painel do comprador passou a existir,
 *     porque "a rota escolhe o painel pelo papel, lido do servidor em
 *     `painel/page.tsx`". `/mapa`, `/market`, `/mensagens`, `/reports`,
 *     `/cloud` e `/contratos` fazem o mesmo.
 *
 * O que **não** é legítimo é a terceira: nenhuma das duas. É essa que este
 * portão recusa.
 *
 * ## Porque é que o portão lê o middleware em vez de ter a sua própria lista
 *
 * Porque duas listas divergem. Se este ficheiro tivesse uma cópia dos
 * prefixos, bastava alguém acrescentar um prefixo ao middleware e não aqui
 * para o portão passar a acusar uma rota que está protegida — e já se viu onde
 * isso acaba: num portão que acusa o inocente e é desligado. As listas são
 * lidas da fonte, e se a forma delas mudar o portão diz que não as encontrou,
 * em vez de adivinhar.
 *
 * ## O que este portão NÃO faz, e é importante saber
 *
 * A segunda forma legítima verifica-se pela **menção** de `role` na página, não
 * pela lógica. Uma página que leia o papel e depois não faça nada com ele passa
 * aqui. É deliberado: a alternativa era seguir o fluxo de dados de um
 * componente de servidor até ao `redirect`, e um portão que tenta isso erra nos
 * dois sentidos — deixa passar o que devia recusar **e** recusa o que devia
 * passar. Entre as duas, a segunda é a que mata o portão.
 *
 * O que ele apanha com certeza é o caso real: a rota nova que ninguém
 * classificou e onde a palavra `role` não aparece. Se for preciso mais do que
 * isso, o instrumento é um teste E2E por papel (12 §11), não mais regex.
 *
 * Correr sozinho:
 *   node scripts/gate/check-route-roles.mjs
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

const RAIZ = process.env.UPM_ROTAS_RAIZ ?? ".";

/**
 * Rotas do `app` que não são de um papel só e **não** leem o papel na página,
 * com a razão. Hoje está vazia de propósito: as oito rotas partilhadas que
 * existem leem todas o papel. Uma entrada aqui é uma rota que qualquer sessão
 * autenticada vê inteira, igual — e isso é uma decisão, não um detalhe.
 */
const APP_PARTILHADAS = new Map();

/**
 * Rotas do `interno` fora das três áreas. As quatro primeiras são o caminho de
 * entrada; a quinta é pessoal e por isso igual para os três papéis.
 */
const INTERNO_FORA_DE_AREA = new Map([
  ["/", "o encaminhador: lê o papel e manda cada um para a sua área"],
  ["/entrar", "pré-sessão (publicPaths do middleware)"],
  ["/verificar-2fa", "pré-sessão (publicPaths do middleware)"],
  ["/configurar-2fa", "inscrição no 2FA, antes de haver AAL2 — o middleware trata-a à parte"],
  ["/definicoes/seguranca", "as definições de segurança da própria conta: iguais para os três papéis"],
]);

function lerLista(fonte, nome) {
  const m = new RegExp(`const\\s+${nome}\\s*(?::[^=]+)?=\\s*\\[([^\\]]*)\\]`).exec(fonte);
  if (!m) return null;
  return [...m[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((x) => x[1]);
}

/** `AREA_PREFIX` é um objeto `{ "/admin": "admin", … }` — lê-se as chaves. */
function lerChavesDeAreaPrefix(fonte) {
  const m = /const\s+AREA_PREFIX\s*=\s*\{([\s\S]*?)\}\s*as\s+const/.exec(fonte);
  if (!m) return null;
  return [...m[1].matchAll(/["'`](\/[^"'`]*)["'`]\s*:/g)].map((x) => x[1]);
}

/** `publicPaths` é uma `const` dentro da função — mesma forma de lista. */
function lerPublicPaths(fonte) {
  const m = /const\s+publicPaths\s*=\s*\[([^\]]*)\]/.exec(fonte);
  if (!m) return null;
  return [...m[1].matchAll(/["'`]([^"'`]+)["'`]/g)].map((x) => x[1]);
}

/**
 * Caminho de ficheiro → rota. Os grupos `(x)` do Next não contam para o URL;
 * os segmentos dinâmicos `[id]` ficam como estão, porque é por eles que uma
 * rota é reconhecida nas listas de prefixos.
 */
function rotaDe(relativo) {
  const partes = relativo
    .split(sep)
    .slice(0, -1)
    .filter((p) => !(p.startsWith("(") && p.endsWith(")")));
  return "/" + partes.join("/");
}

function paginas(dir, base, out = []) {
  if (!existsSync(dir)) return out;
  for (const entrada of readdirSync(dir, { withFileTypes: true })) {
    if (entrada.name === "node_modules" || entrada.name === ".next" || entrada.name === ".next-e2e") continue;
    const cheio = join(dir, entrada.name);
    if (entrada.isDirectory()) paginas(cheio, base, out);
    else if (entrada.name === "page.tsx") out.push(cheio);
  }
  return out;
}

const problemas = [];
const avisos = [];

// --- app -------------------------------------------------------------------
{
  const mwPath = join(RAIZ, "apps", "app", "src", "middleware.ts");
  const raizApp = join(RAIZ, "apps", "app", "src", "app");

  if (!existsSync(mwPath)) {
    avisos.push("apps/app/src/middleware.ts não existe — nada a verificar no `app`");
  } else {
    const fonte = readFileSync(mwPath, "utf8");
    const listas = {
      OWNER_ONLY_PREFIXES: lerLista(fonte, "OWNER_ONLY_PREFIXES"),
      BUYER_ONLY_PREFIXES: lerLista(fonte, "BUYER_ONLY_PREFIXES"),
      PUBLIC_PREFIXES: lerLista(fonte, "PUBLIC_PREFIXES"),
      NO_SUBSCRIPTION_PREFIXES: lerLista(fonte, "NO_SUBSCRIPTION_PREFIXES"),
    };

    const emFalta = Object.entries(listas)
      .filter(([, v]) => v === null)
      .map(([k]) => k);
    if (emFalta.length > 0) {
      problemas.push({
        titulo: "Não consegui ler as listas de prefixos do `app`",
        linhas: emFalta.map((k) => `apps/app/src/middleware.ts  \`${k}\``),
        porque: [
          "Este portão lê os prefixos da fonte para não ter uma cópia que divirja.",
          "Se a forma da lista mudou, ajuste `lerLista` em `check-route-roles.mjs` —",
          "não escreva aqui uma segunda lista.",
        ],
      });
    } else {
      const prefixos = Object.values(listas).flat();
      const descobertas = [];

      for (const ficheiro of paginas(raizApp, raizApp)) {
        const rota = rotaDe(ficheiro.slice(raizApp.length + 1));
        if (rota === "/") continue; // a raiz encaminha pelo papel, por definição
        if (prefixos.some((p) => rota === p || rota.startsWith(p + "/"))) continue;
        if (APP_PARTILHADAS.has(rota)) continue;
        // A segunda forma legítima: a página resolve o papel ela mesma.
        if (/\brole\b/.test(readFileSync(ficheiro, "utf8"))) continue;
        descobertas.push(`apps/app/src/app${ficheiro.slice(raizApp.length)}  → \`${rota}\``);
      }

      if (descobertas.length > 0) {
        problemas.push({
          titulo: "Rota do `app` sem papel decidido (12 §12.4)",
          linhas: descobertas,
          porque: [
            "Esta rota não está em nenhum prefixo do `middleware.ts` e a página não lê",
            "o papel. Logo qualquer sessão autenticada a vê inteira — um comprador vê",
            "o que é do proprietário, e ao contrário.",
            "",
            "Três saídas, por ordem de preferência: (a) acrescentar o prefixo a",
            "`OWNER_ONLY_PREFIXES` ou `BUYER_ONLY_PREFIXES`; (b) ler o papel na página",
            "e servir o conteúdo de cada um, como `/painel` faz; (c) se a rota é mesmo",
            "igual para os dois, declará-la em `APP_PARTILHADAS` com a razão.",
          ],
        });
      }
    }
  }
}

// --- interno ---------------------------------------------------------------
{
  const mwPath = join(RAIZ, "apps", "interno", "src", "middleware.ts");
  const raizInterno = join(RAIZ, "apps", "interno", "src", "app");

  if (!existsSync(mwPath)) {
    avisos.push("apps/interno/src/middleware.ts não existe — nada a verificar no `interno`");
  } else {
    const fonte = readFileSync(mwPath, "utf8");
    const areas = lerChavesDeAreaPrefix(fonte);
    const publicos = lerPublicPaths(fonte);

    if (!areas || !publicos) {
      problemas.push({
        titulo: "Não consegui ler as áreas do `interno`",
        linhas: [
          `apps/interno/src/middleware.ts  ${!areas ? "`AREA_PREFIX`" : ""} ${
            !publicos ? "`publicPaths`" : ""
          }`.trim(),
        ],
        porque: [
          "Mesma razão do `app`: os prefixos leem-se da fonte. Ajuste o leitor em",
          "`check-route-roles.mjs` em vez de duplicar a lista.",
        ],
      });
    } else {
      const conhecidos = [...areas, ...publicos];
      const descobertas = [];

      for (const ficheiro of paginas(raizInterno, raizInterno)) {
        const rota = rotaDe(ficheiro.slice(raizInterno.length + 1));
        if (conhecidos.some((p) => rota === p || rota.startsWith(p + "/"))) continue;
        if (INTERNO_FORA_DE_AREA.has(rota)) continue;
        descobertas.push(`apps/interno/src/app${ficheiro.slice(raizInterno.length)}  → \`${rota}\``);
      }

      if (descobertas.length > 0) {
        problemas.push({
          titulo: "Rota do `interno` fora das três áreas (12 §12.4 · 07 §24.6)",
          linhas: descobertas,
          porque: [
            "O guarda do `interno` é por prefixo de área — `/admin`, `/suporte`,",
            "`/marketing` — e de propósito: o marketing **não** é staff, e um guarda",
            "que lesse `is_staff()` dava-lhe a moderação de imóveis e o diretório de",
            "utilizadores de uma vez.",
            "",
            "Uma rota fora das três é vista pelos três papéis. Ponha-a dentro da área",
            "a que pertence, ou declare-a em `INTERNO_FORA_DE_AREA` com a razão.",
          ],
        });
      }
    }
  }
}

for (const aviso of avisos) console.error(`⚠ ${aviso}`);

if (problemas.length === 0) {
  console.log(
    "✓ Rotas por papel: todas as páginas do `app` e do `interno` têm o papel decidido" +
      (avisos.length > 0 ? " (com avisos)" : ""),
  );
  process.exit(0);
}

for (const p of problemas) {
  console.error(`✗ ${p.titulo}:\n`);
  for (const linha of p.linhas) console.error(`      ${linha}`);
  console.error("");
  for (const linha of p.porque) console.error(`  ${linha}`);
  console.error("");
}

process.exit(1);
