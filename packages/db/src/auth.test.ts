import { describe, expect, it } from "vitest";

import {
  STEP_UP_VALIDITY_MS,
  consumeRecoveryCode,
  emailSchema,
  generateRecoveryCodes,
  hashPin,
  isStepUpRequiredError,
  passwordSchema,
  pinSchema,
  totpCodeSchema,
  verifyPin,
} from "./auth";

describe("schemas de input (08 §7.8)", () => {
  it("normaliza e-mails (trim + lowercase)", () => {
    expect(emailSchema.parse("  Alguem@Example.com  ")).toBe("alguem@example.com");
    expect(emailSchema.safeParse("não-é-email").success).toBe(false);
  });

  it("exige mínimo 10 caracteres na password (08 §7.7)", () => {
    expect(passwordSchema.safeParse("curta123").success).toBe(false);
    expect(passwordSchema.safeParse("password-valida-123").success).toBe(true);
  });

  it("PIN entre 4 e 6 dígitos, só números (07 §6)", () => {
    expect(pinSchema.safeParse("123").success).toBe(false);
    expect(pinSchema.safeParse("1234").success).toBe(true);
    expect(pinSchema.safeParse("123456").success).toBe(true);
    expect(pinSchema.safeParse("1234567").success).toBe(false);
    expect(pinSchema.safeParse("12ab").success).toBe(false);
  });

  it("código TOTP são sempre 6 dígitos", () => {
    expect(totpCodeSchema.safeParse("123456").success).toBe(true);
    expect(totpCodeSchema.safeParse("12345").success).toBe(false);
  });
});

describe("PIN de operação — Argon2id (07 §6, 08 §7.7)", () => {
  it("faz round-trip hash → verify", async () => {
    const hash = await hashPin("482913");
    expect(hash).toContain("argon2id");
    expect(await verifyPin("482913", hash)).toBe(true);
    expect(await verifyPin("000000", hash)).toBe(false);
  });

  it("dois hashes do mesmo PIN são diferentes (salt aleatório)", async () => {
    const a = await hashPin("482913");
    const b = await hashPin("482913");
    expect(a).not.toBe(b);
  });
});

describe("Códigos de recuperação do 2FA (07 §6)", () => {
  it("gera o número pedido de códigos, sem repetir, formato XXXX-XXXX", () => {
    const codes = generateRecoveryCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  });

  it("consome um código válido e devolve a lista sem ele (single-use)", async () => {
    const [code] = generateRecoveryCodes(3);
    const hashes = await Promise.all(generateRecoveryCodes(1).map((c) => hashPin(c)));
    const hashOfCode = await hashPin(code!);
    const allHashes = [...hashes, hashOfCode];

    const result = await consumeRecoveryCode(code!, allHashes);
    expect(result.matched).toBe(true);
    expect(result.remaining).toHaveLength(allHashes.length - 1);

    const second = await consumeRecoveryCode(code!, result.remaining);
    expect(second.matched).toBe(false);
  });

  it("um código nunca usado não é aceite", async () => {
    const hashes = await Promise.all(generateRecoveryCodes(3).map((c) => hashPin(c)));
    const result = await consumeRecoveryCode("ZZZZ-ZZZZ", hashes);
    expect(result.matched).toBe(false);
    expect(result.remaining).toEqual(hashes);
  });
});

describe("step-up do PIN (07 §6, P8-07)", () => {
  it("reconhece a recusa por falta de PIN pelo hint, não pela mensagem", () => {
    expect(
      isStepUpRequiredError({
        code: "42501",
        message: "Confirmação por PIN necessária",
        hint: "step_up_required",
      }),
    ).toBe(true);
  });

  it("não confunde falta de permissão com falta de PIN", () => {
    // Mesmo `errcode`, outra causa: aqui a UI tem de mostrar erro, não abrir o
    // modal do PIN.
    expect(isStepUpRequiredError({ code: "42501", message: "permission denied" })).toBe(false);
    expect(isStepUpRequiredError({ code: "23505", hint: null })).toBe(false);
    expect(isStepUpRequiredError(null)).toBe(false);
    expect(isStepUpRequiredError("step_up_required")).toBe(false);
  });

  it("a janela de validade é a de 07 §6", () => {
    expect(STEP_UP_VALIDITY_MS).toBe(15 * 60 * 1000);
  });
});
