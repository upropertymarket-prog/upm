import { afterEach, describe, expect, it } from "vitest";

import {
  applySecurityHeaders,
  buildContentSecurityPolicy,
  clientIpFrom,
  cspReportUri,
  invalidCidrsIn,
  isIpAllowed,
} from "./security";

/**
 * A allowlist de IP do `interno` (07 §6 · 12 §2.3, bloqueador B1).
 *
 * Este ficheiro existe por causa de um defeito que esteve lá meses sem dar
 * sinal: a versão anterior de `isIpAllowed` só sabia IPv4 e **ignorava em
 * silêncio** qualquer CIDR com `:`. Quem escrevesse a allowlist com o prefixo
 * IPv6 do escritório via a lista guardada e a regra não se aplicava a ninguém.
 * Não havia erro, não havia aviso: havia uma fechadura com o trinco limado.
 *
 * Daí os testes serem mais sobre o que **não** passa do que sobre o que passa.
 */
const cabecalhos = (mapa: Record<string, string>) => ({
  get: (chave: string) => mapa[chave.toLowerCase()] ?? null,
});

describe("isIpAllowed — IPv4", () => {
  it("aceita o endereço exato, sem prefixo", () => {
    expect(isIpAllowed("192.0.2.7", ["192.0.2.7"])).toBe(true);
    expect(isIpAllowed("192.0.2.8", ["192.0.2.7"])).toBe(false);
  });

  it("respeita a fronteira do prefixo", () => {
    expect(isIpAllowed("192.0.2.1", ["192.0.2.0/24"])).toBe(true);
    expect(isIpAllowed("192.0.2.255", ["192.0.2.0/24"])).toBe(true);
    expect(isIpAllowed("192.0.3.1", ["192.0.2.0/24"])).toBe(false);
  });

  it("`/0` abre a tudo e `/32` só ao próprio", () => {
    expect(isIpAllowed("203.0.113.9", ["0.0.0.0/0"])).toBe(true);
    expect(isIpAllowed("203.0.113.9", ["203.0.113.9/32"])).toBe(true);
    expect(isIpAllowed("203.0.113.10", ["203.0.113.9/32"])).toBe(false);
  });
});

describe("isIpAllowed — IPv6 (a correção de 28 out 2026)", () => {
  it("REGRESSÃO: um CIDR IPv6 já não é ignorado em silêncio", () => {
    // Antes da correção isto devolvia `false` para TUDO, porque o CIDR era
    // descartado e não sobrava nenhuma regra para corresponder.
    expect(isIpAllowed("2001:db8::1", ["2001:db8::/32"])).toBe(true);
    expect(isIpAllowed("2001:db9::1", ["2001:db8::/32"])).toBe(false);
  });

  it("entende a forma comprimida e a expandida como o mesmo endereço", () => {
    expect(isIpAllowed("2001:0db8:0000:0000:0000:0000:0000:0001", ["2001:db8::1"])).toBe(true);
    expect(isIpAllowed("::1", ["::1/128"])).toBe(true);
  });

  it("é indiferente a maiúsculas", () => {
    expect(isIpAllowed("2001:DB8::AB", ["2001:db8::ab"])).toBe(true);
  });

  it("respeita prefixos que não caem em fronteira de grupo", () => {
    expect(isIpAllowed("2001:db8:1::1", ["2001:db8::/47"])).toBe(true);
    expect(isIpAllowed("2001:db8:2::1", ["2001:db8::/47"])).toBe(false);
  });
});

describe("isIpAllowed — as duas famílias não se misturam", () => {
  it("um IP de uma família não corresponde a um CIDR da outra", () => {
    expect(isIpAllowed("2001:db8::1", ["192.0.2.0/24"])).toBe(false);
    expect(isIpAllowed("192.0.2.1", ["2001:db8::/32"])).toBe(false);
  });

  it("um IPv4-mapeado conta como o IPv4 que é", () => {
    // É a forma que um proxy entrega com frequência. São o mesmo computador, e
    // uma allowlist escrita em IPv4 tem de o reconhecer.
    expect(isIpAllowed("::ffff:192.0.2.7", ["192.0.2.0/24"])).toBe(true);
    expect(isIpAllowed("::ffff:192.0.3.7", ["192.0.2.0/24"])).toBe(false);
  });

  it("`::1` não é `127.0.0.1`", () => {
    expect(isIpAllowed("::1", ["127.0.0.0/8"])).toBe(false);
  });
});

describe("isIpAllowed — falha fechada", () => {
  it("lista vazia significa desativado", () => {
    expect(isIpAllowed("192.0.2.7", [])).toBe(true);
  });

  it("um IP que não se interpreta não passa", () => {
    for (const lixo of ["", "   ", "nao-e-um-ip", "192.0.2", "192.0.2.256", "1.2.3.4.5", "::ggg"]) {
      expect(isIpAllowed(lixo, ["0.0.0.0/0"])).toBe(false);
    }
  });

  it("uma entrada malformada na lista não abre a porta", () => {
    expect(isIpAllowed("192.0.2.7", ["isto-nao-e-um-cidr"])).toBe(false);
    expect(isIpAllowed("192.0.2.7", ["192.0.2.0/33"])).toBe(false);
    expect(isIpAllowed("192.0.2.7", ["192.0.2.0/-1"])).toBe(false);
    expect(isIpAllowed("2001:db8::1", ["2001:db8::/129"])).toBe(false);
  });

  it("as entradas válidas continuam a valer ao lado de uma malformada", () => {
    expect(isIpAllowed("192.0.2.7", ["lixo/24", "192.0.2.0/24"])).toBe(true);
  });

  it("porta e zona não enganam a comparação", () => {
    expect(isIpAllowed("192.0.2.7:51000", ["192.0.2.0/24"])).toBe(true);
    expect(isIpAllowed("[2001:db8::1]:443", ["2001:db8::/32"])).toBe(true);
    expect(isIpAllowed("fe80::1%eth0", ["fe80::/10"])).toBe(true);
  });
});

describe("invalidCidrsIn", () => {
  it("nomeia só as entradas que a allowlist não entende", () => {
    expect(invalidCidrsIn(["192.0.2.0/24", "2001:db8::/32", "lixo", "10.0.0.0/99"])).toEqual([
      "lixo",
      "10.0.0.0/99",
    ]);
  });

  it("uma lista inteiramente válida não produz avisos", () => {
    expect(invalidCidrsIn(["192.0.2.7", "2001:db8::/32", "0.0.0.0/0"])).toEqual([]);
  });
});

describe("clientIpFrom — a ordem dos cabeçalhos é a defesa", () => {
  it("prefere o cabeçalho que só um proxy conhecido escreve", () => {
    // `x-forwarded-for` é escrito pelo cliente. Se os dois vierem, o do proxy
    // ganha — senão bastava mandar um XFF forjado para entrar na allowlist.
    expect(
      clientIpFrom(
        cabecalhos({ "cf-connecting-ip": "192.0.2.7", "x-forwarded-for": "203.0.113.1" }),
      ),
    ).toBe("192.0.2.7");

    expect(
      clientIpFrom(cabecalhos({ "x-real-ip": "192.0.2.7", "x-forwarded-for": "203.0.113.1" })),
    ).toBe("192.0.2.7");
  });

  it("usa o x-forwarded-for só como último recurso, e o primeiro valor", () => {
    expect(clientIpFrom(cabecalhos({ "x-forwarded-for": "192.0.2.7, 10.0.0.1, 10.0.0.2" }))).toBe(
      "192.0.2.7",
    );
  });

  it("ignora valores vazios em vez de os devolver", () => {
    expect(clientIpFrom(cabecalhos({ "x-real-ip": "   ", "x-forwarded-for": "192.0.2.7" }))).toBe(
      "192.0.2.7",
    );
    expect(clientIpFrom(cabecalhos({ "x-forwarded-for": ", , 192.0.2.7" }))).toBe("192.0.2.7");
  });

  it("sem nenhum cabeçalho não inventa um IP", () => {
    expect(clientIpFrom(cabecalhos({}))).toBeNull();
    expect(clientIpFrom(cabecalhos({ "x-forwarded-for": "" }))).toBeNull();
  });
});

describe("CSP", () => {
  it("não deixa entrar `unsafe-inline` nem `unsafe-eval` em script-src", () => {
    const script = buildContentSecurityPolicy("abc123")
      .split("; ")
      .find((d) => d.startsWith("script-src"));

    expect(script).toContain("'nonce-abc123'");
    expect(script).not.toContain("unsafe-inline");
    expect(script).not.toContain("unsafe-eval");
  });

  it("em produção, `unsafe-eval` nunca; em `next dev`, sim — e só aí", () => {
    const original = process.env.NODE_ENV;
    const scriptSrc = () =>
      buildContentSecurityPolicy("n")
        .split("; ")
        .find((d) => d.startsWith("script-src"));
    try {
      (process.env as Record<string, string>).NODE_ENV = "production";
      expect(scriptSrc()).not.toContain("unsafe-eval");
      (process.env as Record<string, string>).NODE_ENV = "development";
      expect(scriptSrc()).toContain("'unsafe-eval'");
      // `unsafe-inline` não entra em nenhum dos dois.
      expect(scriptSrc()).not.toContain("unsafe-inline");
    } finally {
      (process.env as Record<string, string>).NODE_ENV = original!;
    }
  });

  it("mantém as diretivas que fecham as variantes de clickjacking e injeção", () => {
    const csp = buildContentSecurityPolicy("n");
    for (const diretiva of [
      "object-src 'none'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ]) {
      expect(csp).toContain(diretiva);
    }
  });
});

describe("relatório de CSP — o alarme com campainha", () => {
  const DSN_ORIGINAL = process.env.NEXT_PUBLIC_SENTRY_DSN;

  afterEach(() => {
    if (DSN_ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    else process.env.NEXT_PUBLIC_SENTRY_DSN = DSN_ORIGINAL;
  });

  it("deriva o endereço do DSN, em vez de o pedir à parte", () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://abc123@o42.ingest.de.sentry.io/7";
    expect(cspReportUri()).toBe(
      "https://o42.ingest.de.sentry.io/api/7/security/?sentry_key=abc123",
    );
  });

  it("emite `report-uri` E `report-to` — o Safari só entende o primeiro", () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://abc123@o42.ingest.de.sentry.io/7";
    const csp = buildContentSecurityPolicy("n");
    expect(csp).toContain("report-uri https://o42.ingest.de.sentry.io/api/7/security/");
    expect(csp).toContain("report-to csp");
  });

  it("o `report-to` vem sempre acompanhado do cabeçalho que lhe dá destino", () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://abc123@o42.ingest.de.sentry.io/7";
    const headers = new Map<string, string>();
    applySecurityHeaders({ set: (k, v) => headers.set(k, v) }, "n");

    expect(headers.get("Reporting-Endpoints")).toBe(
      'csp="https://o42.ingest.de.sentry.io/api/7/security/?sentry_key=abc123"',
    );
  });

  it("SEM DSN não emite diretiva nenhuma — nem meia", () => {
    // É o caso que interessa prender: uma `report-uri` a apontar para lado
    // nenhum faz o browser tentar e falhar em cada violação, e deixa a CSP
    // com uma diretiva que parece configurada e não está.
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    const csp = buildContentSecurityPolicy("n");

    expect(cspReportUri()).toBeNull();
    expect(csp).not.toContain("report-uri");
    expect(csp).not.toContain("report-to");

    const headers = new Map<string, string>();
    applySecurityHeaders({ set: (k, v) => headers.set(k, v) }, "n");
    expect(headers.has("Reporting-Endpoints")).toBe(false);
  });

  it("um DSN malformado não parte a CSP da app inteira", () => {
    for (const mau of ["isto-não-é-um-url", "https://sem-chave.sentry.io/7", "https://k@host/"]) {
      process.env.NEXT_PUBLIC_SENTRY_DSN = mau;
      expect(cspReportUri()).toBeNull();
      // E o resto da política continua inteiro.
      expect(buildContentSecurityPolicy("n")).toContain("frame-ancestors 'none'");
    }
  });
});
