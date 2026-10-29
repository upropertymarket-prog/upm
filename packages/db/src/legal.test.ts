import { describe, expect, it } from "vitest";

import { acceptedCheckboxSchema, termsAcceptanceSchema } from "./legal";

/**
 * Os esquemas de aceitação dos Termos (P9-02, P9-09).
 *
 * Este ficheiro nasceu da migração para o `zod` 4, a 28 out 2026, e é sobre
 * uma lição mais do que sobre um esquema: a v4 **ignora em silêncio** o
 * parâmetro `errorMap` da v3. Não dá erro de tipo, não dá aviso — a mensagem
 * personalizada desaparece e aparece `Invalid input: expected "on"`, em inglês,
 * na caixa de aceitação dos Termos.
 *
 * Nos dois sítios equivalentes de `pre-inscricao/actions.ts` a quebra teria
 * sido apanhada, porque lá havia testes a afirmar a frase exata. Aqui não
 * havia nenhum, e é isso que estes testes corrigem: a mensagem que o
 * utilizador lê é parte do contrato, e um texto legal em inglês numa caixa
 * obrigatória é um problema de conformidade, não um detalhe de cosmética.
 */
describe("acceptedCheckboxSchema", () => {
  it("aceita a caixa marcada", () => {
    expect(acceptedCheckboxSchema.safeParse("on").success).toBe(true);
  });

  it("recusa a caixa não marcada — e nunca vem pré-marcada", () => {
    for (const valor of ["", "off", undefined, null, false, "true"]) {
      expect(acceptedCheckboxSchema.safeParse(valor).success).toBe(false);
    }
  });

  it("a mensagem de recusa é a nossa, em português", () => {
    const resultado = acceptedCheckboxSchema.safeParse("");
    expect(resultado.success).toBe(false);
    if (resultado.success) return;
    expect(resultado.error.issues[0]?.message).toBe(
      "Tem de aceitar os Termos e Condições para continuar.",
    );
  });
});

describe("termsAcceptanceSchema", () => {
  const valido = {
    documentId: "b7f1c2d4-5e6a-4b8c-9d0e-1f2a3b4c5d6e",
    contentHash: "a".repeat(64),
    context: "registration" as const,
  };

  it("aceita uma aceitação completa", () => {
    expect(termsAcceptanceSchema.safeParse(valido).success).toBe(true);
  });

  it("exige um `documentId` que seja um UUID", () => {
    expect(termsAcceptanceSchema.safeParse({ ...valido, documentId: "123" }).success).toBe(false);
  });

  it("o `contentHash` é um sha256 em hexadecimal e nada mais", () => {
    // É a prova de que o texto aceite é o texto mostrado: se o documento mudou
    // entre o ecrã abrir e o botão ser premido, a aceitação é recusada.
    for (const hash of ["a".repeat(63), "a".repeat(65), "A".repeat(64), "z".repeat(64), ""]) {
      expect(termsAcceptanceSchema.safeParse({ ...valido, contentHash: hash }).success).toBe(false);
    }
  });

  it("o contexto é um dos três conhecidos", () => {
    for (const context of ["registration", "subscription", "reacceptance"]) {
      expect(termsAcceptanceSchema.safeParse({ ...valido, context }).success).toBe(true);
    }
    expect(termsAcceptanceSchema.safeParse({ ...valido, context: "qualquer" }).success).toBe(false);
  });
});
