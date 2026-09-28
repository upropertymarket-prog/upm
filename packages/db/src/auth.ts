import { randomBytes } from "node:crypto";

import { argon2id, argon2Verify } from "hash-wasm";
import { z } from "zod";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * Autenticação e onboarding (Fase 3) — 07 §6, 08 §5, 07 §9.1.
 * =========================================================================
 * Partilhado pelas 3 apps: schemas de input, rate limiting (RPC contra
 * `auth_attempts`) e o PIN de operação do `interno` (Argon2id via hash-wasm,
 * WASM puro — corre em funções serverless sem binário nativo).
 *
 * O 2FA TOTP do `interno` **não** vive aqui: usa o MFA nativo do Supabase Auth
 * (`supabase.auth.mfa.*`), que já gera e guarda o segredo de forma auditada —
 * ver o relatório da Fase 3 (patch a 07 §6). `staff_auth` só guarda o PIN e os
 * códigos de recuperação.
 */

// ---------------------------------------------------------------------------
// Schemas de input — validados sempre no servidor (08 §7.8), nunca só no
// cliente.
// ---------------------------------------------------------------------------

export const emailSchema = z.string().trim().toLowerCase().email("E-mail inválido").max(254);

// 08 §7.7: política mínima de password. A verificação contra listas de
// passwords vazadas (haveibeenpwned k-anonymity) corre à parte, em
// `checkPasswordNotPwned`, por precisar de um pedido de rede.
export const passwordSchema = z
  .string()
  .min(10, "Mínimo 10 caracteres")
  .max(72, "Máximo 72 caracteres");

export const pinSchema = z.string().regex(/^\d{4,6}$/, "O PIN tem de ter entre 4 e 6 dígitos");

export const totpCodeSchema = z.string().regex(/^\d{6}$/, "Código de 6 dígitos");

export const fullNameSchema = z.string().trim().min(1).max(160);

export const roleAtRegistrationSchema = z.enum(["buyer", "owner"]);

// ---------------------------------------------------------------------------
// Rate limiting (fallback em Postgres — 07 §9.1)
// ---------------------------------------------------------------------------

export const AUTH_ATTEMPT_KINDS = [
  "login",
  "register",
  "password_recovery",
  "resend_verification",
  "totp_challenge",
  "pin_verify",
] as const;
export type AuthAttemptKind = (typeof AUTH_ATTEMPT_KINDS)[number];

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

type AnySupabaseClient = SupabaseClient<Database>;

/**
 * Chamar ANTES de tentar a ação. Falha aberta (`allowed: true`) se o RPC em si
 * falhar — a proteção contra abuso não deve poder trancar um utilizador
 * legítimo fora por um problema de rede; a verificação de credenciais em si
 * continua a ser a defesa principal.
 */
export async function checkAuthRateLimit(
  supabase: AnySupabaseClient,
  identifier: string,
  kind: AuthAttemptKind,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc("check_auth_rate_limit", {
    p_identifier: identifier,
    p_kind: kind,
  });
  if (error || !data) return { allowed: true, retryAfterSeconds: 0 };
  const result = data as { allowed: boolean; retry_after_seconds: number };
  return { allowed: result.allowed, retryAfterSeconds: result.retry_after_seconds };
}

/** Chamar DEPOIS de saber o resultado. Nunca lança — é só telemetria. */
export async function recordAuthAttempt(
  supabase: AnySupabaseClient,
  identifier: string,
  kind: AuthAttemptKind,
  succeeded: boolean,
): Promise<void> {
  await supabase.rpc("record_auth_attempt", {
    p_identifier: identifier,
    p_kind: kind,
    p_succeeded: succeeded,
  });
}

// ---------------------------------------------------------------------------
// PIN de operação — Argon2id (08 §7.7), formato PHC (salt e parâmetros
// embutidos no próprio hash, sem coluna separada).
// ---------------------------------------------------------------------------

const PIN_ARGON2_OPTIONS = {
  iterations: 3,
  memorySize: 19456, // ~19 MiB — recomendação OWASP para argon2id interativo
  parallelism: 1,
  hashLength: 32,
} as const;

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  return argon2id({
    password: pin,
    salt,
    ...PIN_ARGON2_OPTIONS,
    outputType: "encoded",
  });
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  try {
    return await argon2Verify({ password: pin, hash });
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Step-up (07 §6) — válido 15 min antes de uma ação sensível em `interno`.
// Nenhuma ação sensível existe ainda nesta fase (chegam nas Fases 4, 8, 9…);
// isto é a infraestrutura pronta para elas chamarem.
// ---------------------------------------------------------------------------

const STEP_UP_VALIDITY_MS = 15 * 60 * 1000;

export async function hasValidStepUp(
  supabase: AnySupabaseClient,
  profileId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("staff_auth")
    .select("last_step_up_at")
    .eq("profile_id", profileId)
    .maybeSingle();
  const lastStepUpAt = (data as { last_step_up_at: string | null } | null)?.last_step_up_at;
  if (!lastStepUpAt) return false;
  return Date.now() - new Date(lastStepUpAt).getTime() < STEP_UP_VALIDITY_MS;
}

export async function markStepUp(supabase: AnySupabaseClient, profileId: string): Promise<void> {
  await supabase
    .from("staff_auth")
    .update({ last_step_up_at: new Date().toISOString() })
    .eq("profile_id", profileId);
}

// ---------------------------------------------------------------------------
// Códigos de recuperação do 2FA (07 §6) — o Supabase MFA não os fornece;
// gerados uma vez no enrolment, hash Argon2id (mesma função do PIN — mesmo
// algoritmo, uso genérico), single-use.
// ---------------------------------------------------------------------------

const RECOVERY_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O/1/I

export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(8);
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += RECOVERY_CODE_ALPHABET[bytes[i]! % RECOVERY_CODE_ALPHABET.length];
      if (i === 3) code += "-";
    }
    return code;
  });
}

/** Verifica um código contra a lista de hashes e devolve a lista sem ele (single-use). */
export async function consumeRecoveryCode(
  code: string,
  hashes: string[],
): Promise<{ matched: boolean; remaining: string[] }> {
  for (let i = 0; i < hashes.length; i++) {
    if (await verifyPin(code, hashes[i]!)) {
      return { matched: true, remaining: [...hashes.slice(0, i), ...hashes.slice(i + 1)] };
    }
  }
  return { matched: false, remaining: hashes };
}

// ---------------------------------------------------------------------------
// Passwords vazadas — haveibeenpwned k-anonymity (08 §7.7). Só o prefixo de
// 5 caracteres do hash SHA-1 sai para a rede; a password em si nunca sai.
// ---------------------------------------------------------------------------

export async function isPasswordPwned(password: string): Promise<boolean> {
  const { createHash } = await import("node:crypto");
  const sha1 = createHash("sha1").update(password).digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const body = await response.text();
    return body.split("\n").some((line) => line.startsWith(suffix));
  } catch {
    // Serviço externo indisponível não deve bloquear o registo (fail open).
    return false;
  }
}
