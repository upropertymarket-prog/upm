/**
 * Cabeçalhos de segurança e CSP (08 §5, dívida D5 — prazo Fase 3).
 * =========================================================================
 * O nonce é gerado uma vez por pedido no `middleware.ts` de cada app, posto
 * no cabeçalho `x-nonce` do pedido (para o layout o ler via `headers()` e
 * passar ao `ThemeScript` de `packages/ui`) e usado no `script-src` da CSP da
 * resposta. Sem `unsafe-inline`/`unsafe-eval` em `script-src` (08 §7.2).
 */

export const NONCE_HEADER = "x-nonce";

export function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Para onde o browser manda o que a CSP bloqueou (12 §5.3)
 * ===========================================================================
 * Uma CSP sem relatório é um alarme sem campainha: não se sabe o que ela está
 * a bloquear nem o que tentou passar. Se amanhã um script legítimo for
 * recusado, o sintoma é "aquela parte do site não funciona" e ninguém liga as
 * duas coisas; se alguém tentar injetar um, não fica rasto nenhum.
 *
 * O endereço é **derivado do DSN do Sentry** e não de uma variável própria, de
 * propósito: duas variáveis para a mesma coisa divergem, e a que diverge é
 * sempre a que ninguém olha. O DSN tem a forma
 * `https://<chave>@<org>.ingest.<região>.sentry.io/<projeto>` e o endpoint de
 * CSP do Sentry monta-se a partir dela.
 *
 * Sem DSN — em desenvolvimento, por exemplo — a diretiva **não é emitida**.
 * Uma CSP a apontar para um sítio que não existe faz o browser tentar e falhar
 * em cada violação, e isso é pior do que não reportar.
 *
 * Nota para quem for ler os relatórios: isto é ruidoso. Extensões de browser
 * injetam scripts em páginas alheias e cada uma dá uma violação que não é
 * nossa. Vale a pena filtrar no Sentry antes de tirar conclusões.
 */
export function cspReportUri(): string | null {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return null;

  try {
    const url = new URL(dsn);
    const chave = url.username;
    const projeto = url.pathname.replace(/^\//, "");
    if (!chave || !projeto) return null;
    return `${url.origin}/api/${projeto}/security/?sentry_key=${chave}`;
  } catch {
    // Um DSN malformado não pode partir a CSP da app inteira.
    return null;
  }
}

/** O nome do grupo em `Reporting-Endpoints`, referido por `report-to`. */
const GRUPO_DE_RELATORIO = "csp";

export function buildContentSecurityPolicy(nonce: string): string {
  const relatorio = cspReportUri();

  // Só em `next dev`: o webpack de desenvolvimento carrega o código de cada
  // rota com `eval`, e sem `'unsafe-eval'` a CSP recusa-o — a navegação no
  // cliente morre sem nada no ecrã (um `router.push` que "não faz nada"). Foi
  // o que o E2E do A5 encontrou a 2 nov, no botão que fecha a configuração do
  // 2FA. É a exceção que o próprio Next documenta para o modo de
  // desenvolvimento; em produção (`next build`) não há `eval` e a diretiva
  // fica fechada, como `security.test.ts` verifica.
  const emDesenvolvimento = process.env.NODE_ENV === "development";

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${emDesenvolvimento ? " 'unsafe-eval'" : ""}`,
    // Tailwind é CSS compilado; 'unsafe-inline' aqui cobre os estilos que o
    // próprio Next injeta (muito menor risco do que em script-src).
    "style-src 'self' 'unsafe-inline'",
    // `https://tiles.openfreemap.org` — tiles do Mapa (P4-05), MapLibre GL,
    // estilo keyless.
    "img-src 'self' data: blob: https://*.supabase.co https://tiles.openfreemap.org",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://tiles.openfreemap.org",
    // MapLibre GL corre o parsing de vetores em Web Workers próprios,
    // carregados como `blob:` — sem isto o mapa fica sem tiles sob a CSP.
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    // `report-uri` está depreciado e é o único que o Safari e os browsers mais
    // antigos entendem; `report-to` é o substituto e precisa do cabeçalho
    // `Reporting-Endpoints`. Vão os dois: entre perder relatórios de metade
    // dos visitantes e escrever duas linhas, escrevem-se as duas linhas.
    ...(relatorio ? [`report-uri ${relatorio}`, `report-to ${GRUPO_DE_RELATORIO}`] : []),
  ].join("; ");
}

export const SECURITY_HEADERS: ReadonlyArray<{ key: string; value: string }> = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self)" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/**
 * Allowlist de IP/VPN do `interno` (07 §6 · 12 §2.3)
 * ===========================================================================
 * Reaproveita `feature_flags` (chave `interno_ip_allowlist`), sem tabela nova.
 * **Lista vazia = desativado**, e é assim que está hoje: a flag está vazia, e
 * portanto esta defesa não está a defender nada (12 §0.1, bloqueador B1).
 *
 * ## IPv6 deixou de ser ignorado
 *
 * Até 28 out 2026 isto só sabia IPv4 e **ignorava em silêncio** qualquer CIDR
 * com `:` na lista. Era a pior forma possível de falhar: quem escrevesse a
 * allowlist com o prefixo IPv6 do escritório via a lista guardada, via o
 * cadeado fechado, e a regra não se aplicava a ninguém que entrasse por IPv6 —
 * que, numa rede moderna, é quase todos. Uma fechadura com o trinco limado.
 *
 * ## IPv4-mapeado conta como IPv4, de propósito
 *
 * Um proxy entrega com frequência `::ffff:192.0.2.7` em vez de `192.0.2.7`.
 * São o mesmo computador, e uma allowlist escrita em IPv4 tem de reconhecê-lo
 * — senão a regra passa a depender do humor da camada de rede.
 *
 * ## Falha fechada
 *
 * Um IP que não se consegue interpretar não passa. Uma entrada malformada na
 * lista não abre a porta: é descartada, e `invalidCidrsIn` existe para que
 * quem a escreveu seja avisado em vez de ficar a pensar que está protegido.
 */
type Endereco = { bits: 32 | 128; valor: bigint };

/** Tira porta, parênteses retos e identificador de zona. */
function limparHost(bruto: string): string {
  let ip = bruto.trim();
  if (ip.startsWith("[")) {
    const fecha = ip.indexOf("]");
    if (fecha === -1) return "";
    ip = ip.slice(1, fecha);
  } else if ((ip.match(/:/g)?.length ?? 0) === 1) {
    // `1.2.3.4:5678` — um só `:` nunca é IPv6.
    ip = ip.split(":")[0]!;
  }
  const zona = ip.indexOf("%");
  return zona === -1 ? ip : ip.slice(0, zona);
}

function lerIpv4(ip: string): bigint | null {
  const partes = ip.split(".");
  if (partes.length !== 4) return null;
  let valor = 0n;
  for (const parte of partes) {
    if (!/^\d{1,3}$/.test(parte)) return null;
    const n = Number(parte);
    if (n > 255) return null;
    valor = (valor << 8n) | BigInt(n);
  }
  return valor;
}

function lerIpv6(ip: string): bigint | null {
  const metades = ip.split("::");
  if (metades.length > 2) return null;

  const grupos = (parte: string) => (parte === "" ? [] : parte.split(":"));
  let esquerda = grupos(metades[0] ?? "");
  const direita = metades.length === 2 ? grupos(metades[1]!) : [];
  let cauda = direita;

  // IPv4 embutido no fim (`::ffff:192.0.2.7`, `64:ff9b::192.0.2.7`).
  const ultimo = (cauda.length > 0 ? cauda : esquerda).at(-1);
  if (ultimo?.includes(".")) {
    const v4 = lerIpv4(ultimo);
    if (v4 === null) return null;
    const alto = (v4 >> 16n).toString(16);
    const baixo = (v4 & 0xffffn).toString(16);
    if (cauda.length > 0) cauda = [...cauda.slice(0, -1), alto, baixo];
    else esquerda = [...esquerda.slice(0, -1), alto, baixo];
  }

  const total = esquerda.length + cauda.length;
  if (metades.length === 1 ? total !== 8 : total > 7) return null;

  const todos = [...esquerda, ...Array.from({ length: 8 - total }, () => "0"), ...cauda];

  let valor = 0n;
  for (const grupo of todos) {
    if (!/^[0-9a-f]{1,4}$/i.test(grupo)) return null;
    valor = (valor << 16n) | BigInt(Number.parseInt(grupo, 16));
  }
  return valor;
}

/** Interpreta um endereço em qualquer das duas famílias. */
function lerEndereco(bruto: string): Endereco | null {
  const ip = limparHost(bruto);
  if (ip === "") return null;

  if (!ip.includes(":")) {
    const v4 = lerIpv4(ip);
    return v4 === null ? null : { bits: 32, valor: v4 };
  }

  const v6 = lerIpv6(ip);
  if (v6 === null) return null;

  // `::ffff:0:0/96` é o espaço IPv4-mapeado: desce-se à família de origem.
  const MAPEADO = 0xffffn << 32n;
  if (v6 >> 32n === MAPEADO >> 32n) return { bits: 32, valor: v6 & 0xffffffffn };

  return { bits: 128, valor: v6 };
}

type Rede = { bits: 32 | 128; base: bigint; prefixo: number };

function lerCidr(bruto: string): Rede | null {
  const [host, prefixoBruto, ...resto] = bruto.trim().split("/");
  if (resto.length > 0) return null;

  const endereco = lerEndereco(host ?? "");
  if (endereco === null) return null;

  const prefixo = prefixoBruto === undefined ? endereco.bits : Number(prefixoBruto);
  if (!Number.isInteger(prefixo) || prefixo < 0 || prefixo > endereco.bits) return null;

  return { bits: endereco.bits, base: endereco.valor, prefixo };
}

/**
 * As entradas que a allowlist não entende. Uma lista com entradas malformadas
 * continua a funcionar com as válidas — mas quem a escreveu tem de saber que
 * uma delas não está a contar, senão confia numa proteção que não existe.
 */
export function invalidCidrsIn(cidrs: readonly string[]): string[] {
  return cidrs.filter((cidr) => lerCidr(cidr) === null);
}

/**
 * Redes a que o nosso servidor nunca tem razão para se ligar (12 §5.5)
 * ===========================================================================
 * Existe por causa da configuração de caixas de e-mail: é o Admin que escreve
 * o anfitrião a que o `mail-worker` se vai ligar. Sem esta lista, esse campo
 * é um pedido para o nosso servidor abrir uma ligação a onde lhe disserem —
 * `127.0.0.1`, `10.0.0.5`, ou o endereço de metadados da instância, que em
 * várias clouds devolve credenciais a quem o visitar.
 *
 * E há um agravante que é fácil não ver: o "Testar ligação" devolve erros
 * **distintos por lado** — recusa, expiração, erro de protocolo. Isso é
 * exatamente o que um scanner de portas precisa de saber. Sem este filtro, o
 * ecrã de configuração é um mapeador da rede interna com interface gráfica.
 *
 * `169.254.169.254` está coberto por `169.254.0.0/16`, que é toda ela
 * link-local e nunca é um destino legítimo nosso.
 */
const REDES_INTERNAS = [
  "0.0.0.0/8", // "este host"
  "10.0.0.0/8", // privada
  "100.64.0.0/10", // CGNAT
  "127.0.0.0/8", // loopback
  "169.254.0.0/16", // link-local — inclui os metadados da cloud
  "172.16.0.0/12", // privada
  "192.0.0.0/24", // atribuições de protocolo
  "192.168.0.0/16", // privada
  "198.18.0.0/15", // testes de desempenho
  "224.0.0.0/4", // multicast
  "240.0.0.0/4", // reservada
  "::1/128", // loopback v6
  "fc00::/7", // únicas locais v6
  "fe80::/10", // link-local v6
  "::/128", // não especificado
] as const;

/**
 * `true` se o endereço cai numa rede interna ou reservada — **e também se não
 * se consegue interpretar**. Falha fechada: um endereço que não entendemos não
 * é um endereço a que nos ligamos.
 */
export function isPrivateOrReservedIp(ip: string): boolean {
  if (!lerEndereco(ip)) return true;
  return isIpAllowed(ip, REDES_INTERNAS);
}

/**
 * Um anfitrião escrito à mão que claramente aponta para dentro.
 *
 * **Não substitui a verificação do IP depois de resolver o nome** — um domínio
 * público pode apontar para `127.0.0.1`, e é assim que o DNS rebinding
 * funciona. Isto apanha o caso óbvio no formulário, para quem está a
 * configurar receber um erro imediato em vez de um timeout três minutos
 * depois; a defesa a sério está em `assertHostIsExternal`, no worker, que
 * corre quando o socket vai mesmo abrir.
 */
export function hostLooksInternal(host: string): boolean {
  const limpo = host.trim().toLowerCase().replace(/\.$/, "");
  if (limpo === "") return true;

  // Um IP escrito diretamente decide-se pelo IP.
  if (/^[0-9.]+$/.test(limpo) || limpo.includes(":") || limpo.startsWith("[")) {
    return isPrivateOrReservedIp(limpo);
  }

  if (limpo === "localhost" || limpo.endsWith(".localhost")) return true;
  // Nomes que só existem dentro de uma rede.
  if (/\.(local|internal|intranet|lan|home|corp|localdomain)$/.test(limpo)) return true;
  // Um nome sem ponto é um nome de máquina da rede local, não um domínio.
  if (!limpo.includes(".")) return true;

  return false;
}

/**
 * As portas de correio que fazem sentido, e só essas (12 §5.5).
 *
 * Uma lista branca e não um intervalo: deixar passar qualquer porta de 1 a
 * 65535 é o que transforma o "Testar ligação" num scanner. São estas que os
 * fornecedores reais usam; se algum dia aparecer um servidor legítimo fora
 * delas, acrescenta-se com a razão escrita ao lado — que é melhor do que
 * deixar as 65 527 restantes abertas por precaução.
 */
export const PORTAS_ENTRADA = [110, 143, 993, 995] as const;
export const PORTAS_SMTP = [25, 465, 587, 2525] as const;

export function isIpAllowed(ip: string, cidrs: readonly string[]): boolean {
  if (cidrs.length === 0) return true;

  const endereco = lerEndereco(ip);
  if (endereco === null) return false;

  return cidrs.some((cidr) => {
    const rede = lerCidr(cidr);
    if (rede === null || rede.bits !== endereco.bits) return false;
    if (rede.prefixo === 0) return true;
    const deslocamento = BigInt(rede.bits - rede.prefixo);
    return endereco.valor >> deslocamento === rede.base >> deslocamento;
  });
}

/**
 * Cabeçalhos em que se confia, por ordem, e **porque é que a ordem importa**.
 * ===========================================================================
 * `x-forwarded-for` é uma lista a que cada salto acrescenta. O primeiro valor é
 * o cliente — e é escrito pelo cliente. Qualquer pessoa pode mandar
 * `X-Forwarded-For: <ip-da-allowlist>` e, se o pedido chegar ao servidor sem
 * passar por um proxy que reescreva o cabeçalho, passa.
 *
 * Daí a ordem: primeiro os cabeçalhos que **só** um proxy conhecido escreve
 * (`cf-connecting-ip` no Cloudflare, `x-real-ip` em nginx e afins), e o
 * `x-forwarded-for` apenas como último recurso.
 *
 * **Isto não substitui o perímetro.** Enquanto a origem for alcançável
 * diretamente, a allowlist de IP é falsificável por cabeçalho — é por isso que
 * 12 §2.1 põe o proxy obrigatório como pré-requisito de B1, e não como
 * melhoria. Em desenvolvimento local não há proxy nenhum e é por isso que a
 * flag está vazia.
 */
const CABECALHOS_DE_CONFIANCA = ["cf-connecting-ip", "true-client-ip", "x-real-ip"] as const;

export function clientIpFrom(headers: { get: (key: string) => string | null }): string | null {
  for (const nome of CABECALHOS_DE_CONFIANCA) {
    const valor = headers.get(nome)?.trim();
    if (valor) return valor;
  }

  const forwardedFor = headers.get("x-forwarded-for");
  if (!forwardedFor) return null;

  const primeiro = forwardedFor
    .split(",")
    .map((parte) => parte.trim())
    .find((parte) => parte !== "");

  return primeiro ?? null;
}

export function applySecurityHeaders(
  headers: {
    set: (key: string, value: string) => void;
  },
  nonce: string,
): void {
  headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));

  // Dá nome ao grupo que o `report-to` da CSP refere. Sem este cabeçalho, o
  // `report-to` aponta para um grupo que não existe e não vai nada — e a CSP
  // fica com uma diretiva que parece configurada e não está.
  const relatorio = cspReportUri();
  if (relatorio) {
    headers.set("Reporting-Endpoints", `${GRUPO_DE_RELATORIO}="${relatorio}"`);
  }

  for (const { key, value } of SECURITY_HEADERS) headers.set(key, value);
}
