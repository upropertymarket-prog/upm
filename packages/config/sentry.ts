/**
 * Limpeza de dados pessoais antes de sair para o Sentry (12 §9.3 · 07 §4.4)
 * ===========================================================================
 * O `sendDefaultPii: false` trava o que o Sentry apanha **sozinho**: o IP, os
 * cabeçalhos, o utilizador. Não trava o que **nós** lhe damos — e é por aí que
 * os dados pessoais saem. Um `captureException` com o objeto do lead anexado
 * leva nome, e-mail e telefone para um subprocessador com outra retenção, e
 * ninguém escreveu "enviar dados pessoais" em sítio nenhum: escreveu
 * "anexar contexto ao erro", que é a coisa certa a fazer.
 *
 * Esta função é a rede. Corre nos nove `sentry.*.config.ts` das três apps, e é
 * **uma** função e não nove cópias de propósito: uma limpeza que vive em nove
 * sítios fica diferente em nove sítios.
 *
 * ## Porque é que se limpa por NOME da chave e não por padrão no texto
 *
 * Por e-mail e por JWT limpa-se por padrão: têm forma inconfundível e não há
 * falsos positivos que custem.
 *
 * Por telefone e por NIF **não**. Os dois são nove dígitos em Portugal, e um
 * padrão de nove dígitos apanharia números de versão, identificadores, códigos
 * de erro, timestamps e metade dos números que aparecem numa mensagem de erro.
 * Uma limpeza que estraga a mensagem de erro é uma limpeza que alguém desliga
 * — e o erro ilegível custa mais do que o número que ela escondeu. Por isso
 * estes limpam-se onde realmente vivem: numa chave chamada `phone`, `nif` ou
 * `tax_id`, dentro de um objeto anexado.
 *
 * A pilha de chamadas **não** é tocada, pela mesma razão: é lá que está a
 * informação para resolver o erro.
 */

export const REDACTED = "[limpo]";

/**
 * `@upm/config` não depende do SDK do Sentry — e não deve, para esta limpeza
 * poder ser testada sem ele. Por isso o evento trata-se pela forma, com uma
 * vista mutável, em vez de pelos tipos do `@sentry/nextjs`.
 *
 * A assinatura é genérica e **sem restrição** de propósito: o `ErrorEvent` do
 * Sentry tem campos tipados e nenhuma assinatura de índice, e uma restrição
 * estrutural (`<T extends EventoSentry>`) torna a função inatribuível ao
 * `beforeSend` deles. Foi o que aconteceu à primeira versão: `tsc` recusou-a
 * nas três apps. Devolve-se a **mesma referência**, limpa no lugar.
 */
type Valor = unknown;
type Objeto = Record<string, Valor>;

const comoObjeto = (valor: Valor): Objeto | null =>
  valor !== null && typeof valor === "object" && !Array.isArray(valor) ? (valor as Objeto) : null;

/**
 * Chaves cujo valor nunca sai daqui. Comparação por conteúdo e sem acentos,
 * para `palavra_passe`, `palavraPasse` e `PALAVRA-PASSE` caírem todas na mesma
 * regra.
 */
const CHAVES_PROIBIDAS = [
  "password",
  "passwd",
  "senha",
  "palavrapasse",
  "token",
  "secret",
  "authorization",
  "cookie",
  "apikey",
  "servicerole",
  "email",
  "mail",
  "phone",
  "telefone",
  "telemovel",
  "nif",
  "taxid",
  "iban",
  "morada",
  "address",
  "postalcode",
  "codigopostal",
  "birth",
  "datanascimento",
];

const normalizarChave = (chave: string) =>
  chave
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const chaveProibida = (chave: string) => {
  const limpa = normalizarChave(chave);
  return CHAVES_PROIBIDAS.some((proibida) => limpa.includes(proibida));
};

/** Os dois padrões que não têm falsos positivos que custem. */
const PADROES = [
  // E-mail.
  { regex: /[\w.+-]+@[\w-]+\.[\w.-]{2,}/g, por: REDACTED },
  // JWT — `eyJ…` é um `{"` em base64, e um token não tem nada a fazer num log.
  { regex: /\beyJ[\w-]{4,}\.[\w-]+\.[\w-]+/g, por: REDACTED },
  // `Bearer <algo>` e `Basic <algo>`.
  { regex: /\b(Bearer|Basic)\s+[\w\-.~+/]+=*/gi, por: `$1 ${REDACTED}` },
];

export function scrubString(texto: string): string {
  return PADROES.reduce((acc, { regex, por }) => acc.replace(regex, por), texto);
}

const PROFUNDIDADE_MAXIMA = 6;

function scrubValor(valor: Valor, profundidade: number, vistos: WeakSet<object>): Valor {
  if (typeof valor === "string") return scrubString(valor);
  if (valor === null || typeof valor !== "object") return valor;
  if (profundidade >= PROFUNDIDADE_MAXIMA) return REDACTED;

  // Um objeto que se refere a si mesmo não pode pôr isto em ciclo.
  if (vistos.has(valor)) return REDACTED;
  vistos.add(valor);

  if (Array.isArray(valor)) {
    return valor.map((item) => scrubValor(item, profundidade + 1, vistos));
  }

  const saida: Objeto = {};
  for (const [chave, item] of Object.entries(valor as Objeto)) {
    saida[chave] = chaveProibida(chave) ? REDACTED : scrubValor(item, profundidade + 1, vistos);
  }
  return saida;
}

export function scrubObject<T>(objeto: T): T {
  return scrubValor(objeto, 0, new WeakSet()) as T;
}

/**
 * `beforeSend` das três apps. Devolve o evento limpo — nunca `null`, porque
 * perder o erro é perder a razão de ter Sentry.
 */
export function scrubSentryEvent<T>(evento: T): T {
  const alvo = comoObjeto(evento);
  if (alvo === null) return evento;

  // Do utilizador fica o `id`, que é um UUID nosso e não identifica ninguém
  // fora da nossa base. Nome, e-mail e IP não saem.
  const utilizador = comoObjeto(alvo["user"]);
  if (utilizador !== null) {
    const id = utilizador["id"];
    alvo["user"] = typeof id === "string" ? { id } : {};
  }

  const pedido = comoObjeto(alvo["request"]);
  if (pedido !== null) {
    delete pedido["cookies"];
    delete pedido["headers"];
    delete pedido["data"];
    delete pedido["query_string"];

    // O caminho serve para saber onde rebentou; a query leva tokens de
    // partilha, e-mails de confirmação e termos de pesquisa.
    if (typeof pedido["url"] === "string") {
      pedido["url"] = pedido["url"].split("?")[0] ?? pedido["url"];
    }
  }

  for (const campo of ["extra", "contexts", "tags"] as const) {
    if (comoObjeto(alvo[campo]) !== null) alvo[campo] = scrubObject(alvo[campo]);
  }

  if (typeof alvo["message"] === "string") alvo["message"] = scrubString(alvo["message"]);

  const valores = comoObjeto(alvo["exception"])?.["values"];
  if (Array.isArray(valores)) {
    for (const bruto of valores) {
      const valor = comoObjeto(bruto);
      if (valor && typeof valor["value"] === "string") {
        valor["value"] = scrubString(valor["value"]);
      }
    }
  }

  if (Array.isArray(alvo["breadcrumbs"])) {
    for (const bruto of alvo["breadcrumbs"]) {
      const breadcrumb = comoObjeto(bruto);
      if (breadcrumb === null) continue;
      if (typeof breadcrumb["message"] === "string") {
        breadcrumb["message"] = scrubString(breadcrumb["message"]);
      }
      if (comoObjeto(breadcrumb["data"]) !== null) {
        breadcrumb["data"] = scrubObject(breadcrumb["data"]);
      }
    }
  }

  return evento;
}
