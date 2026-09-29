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

export function buildContentSecurityPolicy(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
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
 * Allowlist de IP/VPN do `interno` (07 §6) — reaproveita `feature_flags`
 * (chave `interno_ip_allowlist`), sem tabela nova. Lista vazia = desativado.
 * Só IPv4; CIDRs IPv6 na lista são ignorados (conhecido, documentado).
 */
function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return null;
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}

export function isIpAllowed(ip: string, cidrs: readonly string[]): boolean {
  if (cidrs.length === 0) return true;
  const ipInt = ipv4ToInt(ip);
  if (ipInt === null) return false;

  return cidrs.some((cidr) => {
    const [range, bitsStr] = cidr.split("/");
    const rangeInt = ipv4ToInt(range ?? "");
    const bits = bitsStr ? Number(bitsStr) : 32;
    if (rangeInt === null || Number.isNaN(bits) || bits < 0 || bits > 32) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipInt & mask) === (rangeInt & mask);
  });
}

export function clientIpFrom(headers: { get: (key: string) => string | null }): string | null {
  const forwardedFor = headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]?.trim() ?? null;
  return headers.get("x-real-ip");
}

export function applySecurityHeaders(
  headers: {
    set: (key: string, value: string) => void;
  },
  nonce: string,
): void {
  headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  for (const { key, value } of SECURITY_HEADERS) headers.set(key, value);
}
