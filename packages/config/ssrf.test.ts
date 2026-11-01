import { describe, expect, it } from "vitest";

import { PORTAS_ENTRADA, PORTAS_SMTP, hostLooksInternal, isPrivateOrReservedIp } from "./security";

/**
 * O filtro de SSRF da configuração de caixas (12 §5.5).
 *
 * O campo "servidor de entrada" do Admin decide a que máquina o `mail-worker`
 * abre um socket. Sem filtro, aceita `localhost` e `169.254.169.254` — e o
 * "Testar ligação" devolve erros distintos por lado, o que faz desse ecrã um
 * scanner de portas da rede interna com interface gráfica.
 *
 * A metade mais importante destes testes é a que **recusa**. A outra existe
 * para o filtro não se tornar uma parede: um anfitrião legítimo de um
 * fornecedor de correio tem de passar, senão isto é desligado na primeira
 * caixa que alguém não consegue configurar.
 */
describe("isPrivateOrReservedIp — o que está lá dentro", () => {
  it("recusa as redes privadas", () => {
    for (const ip of ["10.0.0.5", "172.16.0.1", "172.31.255.254", "192.168.1.1"]) {
      expect(isPrivateOrReservedIp(ip)).toBe(true);
    }
  });

  it("recusa o loopback, nas duas famílias", () => {
    for (const ip of ["127.0.0.1", "127.1.2.3", "::1"]) {
      expect(isPrivateOrReservedIp(ip)).toBe(true);
    }
  });

  it("recusa o endereço de metadados da cloud", () => {
    // O que devolve credenciais a quem o visitar, em várias clouds.
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
  });

  it("recusa CGNAT, multicast e reservadas", () => {
    for (const ip of ["100.64.0.1", "224.0.0.1", "240.0.0.1", "0.0.0.0", "198.18.0.1"]) {
      expect(isPrivateOrReservedIp(ip)).toBe(true);
    }
  });

  it("recusa as locais de IPv6", () => {
    for (const ip of ["fc00::1", "fd12:3456::1", "fe80::1", "::"]) {
      expect(isPrivateOrReservedIp(ip)).toBe(true);
    }
  });

  it("falha fechada: o que não se interpreta não é destino", () => {
    for (const lixo of ["", "não-é-um-ip", "999.999.999.999", "1.2.3"]) {
      expect(isPrivateOrReservedIp(lixo)).toBe(true);
    }
  });

  it("deixa passar o que é mesmo público", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "185.199.108.153", "2606:4700::1111"]) {
      expect(isPrivateOrReservedIp(ip)).toBe(false);
    }
  });

  it("um IPv4-mapeado não escapa pela porta dos fundos", () => {
    // `::ffff:127.0.0.1` é `127.0.0.1` escrito de outra maneira, e seria a
    // primeira coisa a tentar.
    expect(isPrivateOrReservedIp("::ffff:127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("::ffff:10.0.0.1")).toBe(true);
  });
});

describe("hostLooksInternal — o que se escreve no formulário", () => {
  it("recusa os nomes que só existem dentro de uma rede", () => {
    for (const host of [
      "localhost",
      "mail.localhost",
      "servidor",
      "mail.local",
      "exchange.internal",
      "correio.intranet",
      "nas.lan",
      "mail.corp",
    ]) {
      expect(hostLooksInternal(host)).toBe(true);
    }
  });

  it("recusa um IP interno escrito diretamente", () => {
    for (const host of ["127.0.0.1", "10.0.0.5", "169.254.169.254", "[::1]"]) {
      expect(hostLooksInternal(host)).toBe(true);
    }
  });

  it("não se deixa enganar por maiúsculas, espaços ou ponto final", () => {
    for (const host of [" LOCALHOST ", "LocalHost.", "  127.0.0.1  "]) {
      expect(hostLooksInternal(host)).toBe(true);
    }
  });

  it("deixa passar os fornecedores reais", () => {
    // Se isto falhar, o filtro é uma parede e vai ser desligado.
    for (const host of [
      "imap.gmail.com",
      "smtp.gmail.com",
      "outlook.office365.com",
      "smtp.sendgrid.net",
      "mail.sapo.pt",
      "imap.mail.me.com",
    ]) {
      expect(hostLooksInternal(host)).toBe(false);
    }
  });

  it("um domínio público NÃO é julgado pelo nome — é o worker que resolve", () => {
    // `interno.exemplo.pt` pode apontar para onde quiser; aqui passa, e é no
    // worker, depois do DNS, que o IP decide. É por isso que a verificação
    // existe nos dois sítios.
    expect(hostLooksInternal("interno.exemplo.pt")).toBe(false);
  });
});

describe("portas — lista branca, não intervalo", () => {
  it("as de correio passam", () => {
    expect(PORTAS_ENTRADA).toContain(993);
    expect(PORTAS_ENTRADA).toContain(143);
    expect(PORTAS_SMTP).toContain(587);
    expect(PORTAS_SMTP).toContain(465);
  });

  it("as que servem para sondar a rede não estão na lista", () => {
    for (const porta of [22, 80, 443, 3306, 5432, 6379, 8080, 9200, 27017]) {
      expect(PORTAS_ENTRADA).not.toContain(porta);
      expect(PORTAS_SMTP).not.toContain(porta);
    }
  });

  it("a lista é curta — é isso que a torna útil", () => {
    expect(PORTAS_ENTRADA.length + PORTAS_SMTP.length).toBeLessThan(12);
  });
});
