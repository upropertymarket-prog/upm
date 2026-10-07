#!/usr/bin/env node
/**
 * Extrai o corpo das minutas legais das migrações e escreve-o como módulo TS,
 * para as storyboards mostrarem o **texto real** e não um resumo.
 * =========================================================================
 * Porquê gerar em vez de copiar: o texto legal vive em `legal_documents`, e a
 * migração é quem o semeia. Uma segunda cópia escrita à mão no canvas diverge
 * ao primeiro ajuste de cláusula — e um canvas que mostra uma versão antiga de
 * um contrato é pior do que um canvas vazio, porque engana quem revê.
 *
 * O que faz: lê os blocos `$tag$ ... $tag$` das migrações v2 e escreve
 * `tempo/designs/canvases/legal/conteudo.generated.ts`.
 *
 * Correr depois de mexer em qualquer minuta:
 *
 *     node scripts/extract-legal-drafts.mjs
 *
 * O ficheiro gerado é commitado: o canvas não corre scripts, importa um módulo.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Cada entrada: a constante gerada, a migração e o delimitador do corpo PT. */
const SOURCES = [
  {
    constName: "TERMOS",
    migration: "20261007120700_terms_v2_draft.sql",
    tag: "terms_pt_v2",
    title: "Termos e Condições de Utilização — UProperty Market",
  },
  {
    // v3 desde 7 out 2026: o marketing passou a assentar em interesse legítimo
    // e não em consentimento. Quando uma minuta ganhar versão, é aqui que se
    // aponta para a nova — o canvas segue a migração, não o contrário.
    constName: "PRIVACIDADE",
    migration: "20261007121200_privacy_v3_draft.sql",
    tag: "privacy_pt_v3",
    title: "Política de Privacidade — UProperty Market",
  },
  {
    constName: "COOKIES",
    migration: "20261007120900_cookies_v2_draft.sql",
    tag: "cookies_pt_v2",
    title: "Política de Cookies — UProperty Market",
  },
];

/**
 * A versão sai da própria migração, não de uma constante — mas tem de ser a que
 * é INSERIDA, e não a que o `update ... set status = 'archived'` menciona. Como
 * a migração nomeia as duas, fica a de número mais alto: uma v2 arquiva sempre
 * uma versão anterior, nunca uma posterior.
 */
function readVersion(sql) {
  const found = [...sql.matchAll(/'(\d{4}\.\d{2}-draft(\d+))'/g)];
  if (found.length === 0) throw new Error("Versão não encontrada na migração");
  return found.sort((a, b) => Number(b[2]) - Number(a[2]))[0][1];
}

function extractBody(sql, tag) {
  const delimiter = `$${tag}$`;
  const start = sql.indexOf(delimiter);
  const end = sql.indexOf(delimiter, start + delimiter.length);
  if (start === -1 || end === -1) {
    throw new Error(`Delimitador ${delimiter} não encontrado aos pares`);
  }
  return sql.slice(start + delimiter.length, end).trim();
}

/** Literal de template: escapar crase, barra e `${`, e nada mais. */
function toTemplateLiteral(text) {
  return "`" + text.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${") + "`";
}

const blocks = [];
const versions = [];

for (const source of SOURCES) {
  const sql = readFileSync(join(repoRoot, "supabase/migrations", source.migration), "utf8");
  // Uma versão POR documento: desde 7 out 2026 as três minutas deixaram de
  // andar a par — a Privacidade foi para `draft3` e as outras ficaram em
  // `draft2`. Uma constante partilhada mentiria sobre duas delas.
  versions.push(`  ${source.constName}: "${readVersion(sql)}",`);
  const body = extractBody(sql, source.tag);
  blocks.push(
    `/** ${source.title} — de \`${source.migration}\`. */\n` +
      `export const ${source.constName} = ${toTemplateLiteral(body)};`,
  );
}

const output = `// GERADO POR scripts/extract-legal-drafts.mjs — NÃO EDITAR À MÃO.
//
// O corpo das minutas legais, tal como as migrações o semeiam em
// \`legal_documents\`. As storyboards de \`canvases/legal\` importam daqui para
// mostrarem o texto real; editar aqui faria o canvas mentir sobre o contrato.
//
// Para atualizar: mexer na migração e correr
//     node scripts/extract-legal-drafts.mjs

/** A versão de cada minuta, lida da respetiva migração. */
export const VERSOES = {
${versions.join("\n")}
} as const;

${blocks.join("\n\n")}
`;

const outPath = join(repoRoot, "tempo/designs/canvases/legal/conteudo.generated.ts");
writeFileSync(outPath, output, "utf8");

console.log(`Escrito ${outPath}`);
for (const [index, source] of SOURCES.entries()) {
  console.log(`  ${source.constName.padEnd(12)} ${versions[index].trim()}  ${source.migration}`);
}
