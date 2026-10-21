/**
 * Os cookies que marcam uma sessão de `interno` (07 §6).
 *
 * Vivem aqui, e não no `middleware.ts`, porque passaram a ter dois donos: o
 * middleware, que os escreve a cada pedido e os apaga quando a sessão expira,
 * e a ação de sair (`app/actions/auth.ts`), que os apaga a pedido do
 * utilizador. Com os nomes escritos nos dois sítios bastava mudar um para o
 * logout deixar de limpar o que julga limpar — e isso não dá erro nenhum, só
 * deixa resíduo de sessão para trás.
 */
export const SESSION_STARTED_COOKIE = "interno_session_started_at";
export const LAST_ACTIVITY_COOKIE = "interno_last_activity_at";

/**
 * O 2FA por código de recuperação não eleva o AAL do Supabase; este cookie é a
 * prova assinada que o substitui (ver `verificar-2fa/actions.ts`). Sobreviver a
 * um logout seria o pior dos resíduos: devolvia o segundo fator a quem voltasse
 * a entrar sem o apresentar.
 */
export const RECOVERY_VERIFIED_COOKIE = "interno_recovery_verified";

/** Tudo o que tem de desaparecer quando a sessão acaba, seja por que via for. */
export const SESSION_COOKIES = [
  SESSION_STARTED_COOKIE,
  LAST_ACTIVITY_COOKIE,
  RECOVERY_VERIFIED_COOKIE,
] as const;
