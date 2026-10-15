import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import { verifyResendSignature } from "./receipts.ts";

/**
 * A assinatura dos recibos (P10-09)
 * =========================================================================
 * O único pedaço de P10-09 que é lógica pura — e o que mais vale provar, porque
 * é o que separa um recibo do Resend de um `POST` de qualquer pessoa. Sem isto
 * verificado, um endpoint que escreve métricas aceitava aberturas inventadas.
 */

const SEGREDO = `whsec_${Buffer.from("um-segredo-de-teste-com-tamanho").toString("base64")}`;

function assinar(raw: string, id: string, timestamp: string, secret = SEGREDO): string {
  const chave = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return `v1,${createHmac("sha256", chave).update(`${id}.${timestamp}.${raw}`).digest("base64")}`;
}

const agora = () => String(Math.floor(Date.now() / 1000));

describe("verifyResendSignature", () => {
  it("aceita uma assinatura válida", () => {
    const raw = '{"type":"email.delivered"}';
    const id = "msg_1";
    const ts = agora();

    expect(
      verifyResendSignature(raw, { id, timestamp: ts, signature: assinar(raw, id, ts) }, SEGREDO),
    ).toEqual({ ok: true });
  });

  it("recusa quando o corpo foi alterado — é o ponto todo", () => {
    const id = "msg_2";
    const ts = agora();
    const assinatura = assinar('{"type":"email.delivered"}', id, ts);

    // O mesmo id, o mesmo timestamp, a mesma assinatura — e um corpo que diz
    // que dez mil pessoas abriram.
    const result = verifyResendSignature(
      '{"type":"email.opened"}',
      { id, timestamp: ts, signature: assinatura },
      SEGREDO,
    );
    expect(result.ok).toBe(false);
  });

  it("recusa um segredo diferente", () => {
    const raw = "{}";
    const id = "msg_3";
    const ts = agora();
    const outro = `whsec_${Buffer.from("outro-segredo-completamente").toString("base64")}`;

    expect(
      verifyResendSignature(
        raw,
        { id, timestamp: ts, signature: assinar(raw, id, ts, outro) },
        SEGREDO,
      ).ok,
    ).toBe(false);
  });

  it("recusa um pedido antigo — uma reentrega repetida contava a mesma abertura", () => {
    const raw = "{}";
    const id = "msg_4";
    // Uma hora atrás: a assinatura é válida e o pedido não.
    const ts = String(Math.floor(Date.now() / 1000) - 3600);

    const result = verifyResendSignature(
      raw,
      { id, timestamp: ts, signature: assinar(raw, id, ts) },
      SEGREDO,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("tolerância");
  });

  it("sem segredo configurado recusa tudo, e diz porquê", () => {
    const raw = "{}";
    const id = "msg_5";
    const ts = agora();

    const result = verifyResendSignature(
      raw,
      { id, timestamp: ts, signature: assinar(raw, id, ts) },
      undefined,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("RESEND_WEBHOOK_SECRET");
  });

  it("recusa sem os cabeçalhos", () => {
    expect(verifyResendSignature("{}", {}, SEGREDO).ok).toBe(false);
    expect(verifyResendSignature("{}", { id: "a", timestamp: agora() }, SEGREDO).ok).toBe(false);
  });

  it("recusa um timestamp que não é um número", () => {
    const result = verifyResendSignature(
      "{}",
      { id: "a", timestamp: "ontem", signature: "v1,x" },
      SEGREDO,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("Timestamp");
  });

  it("aceita quando uma de várias assinaturas serve — é o caso da rotação", () => {
    const raw = '{"type":"email.clicked"}';
    const id = "msg_6";
    const ts = agora();
    const antiga = `whsec_${Buffer.from("o-segredo-antigo-em-rotacao").toString("base64")}`;

    // O Svix manda as duas durante uma rotação, separadas por espaço.
    const cabecalho = `${assinar(raw, id, ts, antiga)} ${assinar(raw, id, ts)}`;
    expect(
      verifyResendSignature(raw, { id, timestamp: ts, signature: cabecalho }, SEGREDO),
    ).toEqual({ ok: true });
  });

  it("ignora versões de assinatura que não conhece", () => {
    const raw = "{}";
    const id = "msg_7";
    const ts = agora();
    const valida = assinar(raw, id, ts);

    // `v2` ainda não existe; a `v1` ao lado é a que conta.
    expect(
      verifyResendSignature(
        raw,
        { id, timestamp: ts, signature: `v2,qualquercoisa ${valida}` },
        SEGREDO,
      ),
    ).toEqual({ ok: true });

    // E sozinha não serve.
    expect(
      verifyResendSignature(raw, { id, timestamp: ts, signature: "v2,qualquercoisa" }, SEGREDO).ok,
    ).toBe(false);
  });
});
