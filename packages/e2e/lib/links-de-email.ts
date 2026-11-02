/**
 * O link que o e-mail levaria, sem precisar de uma caixa de correio
 * =========================================================================
 * O site usa o fluxo PKCE do Supabase: o link do e-mail só funciona no mesmo
 * browser que fez o pedido, porque é lá que fica o verificador. Por isso não
 * serve o `generateLink` da API de administração — gera outro token, de
 * outro fluxo, que a rota `auth/confirm` não aceita.
 *
 * Faz-se como um humano faria: pede-se no ecrã (o browser guarda o
 * verificador), lê-se o token que o Supabase acabou de gerar para esse
 * pedido, e abre-se no mesmo browser o link de verificação que o e-mail
 * traria. O token lê-se de `auth.users` pela CLI do Supabase — só leitura, e
 * só a coluna desse utilizador.
 */
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { SUPABASE_URL } from "./ambiente";

const RAIZ = fileURLToPath(new URL("../../../", import.meta.url));
const CLI = fileURLToPath(new URL("../../../node_modules/.bin/supabase", import.meta.url));

/** O token que o último e-mail de recuperação ou de confirmação deixou no utilizador. */
export function tokenDeEmail(
  utilizador: string,
  coluna: "recovery_token" | "confirmation_token",
): string {
  if (!/^[0-9a-f-]{36}$/i.test(utilizador)) throw new Error("id de utilizador inválido");
  // Uma linha só, com o SQL entre aspas: no Windows o `.cmd` corre por uma
  // shell, e uma lista de argumentos chega-lhe partida às palavras (visto a
  // 2 nov: "Unexpected positional arguments"). O id foi validado acima — é a
  // única coisa que entra na consulta.
  const comando = process.platform === "win32" ? `"${CLI}.cmd"` : `"${CLI}"`;
  const sql = `select ${coluna} as token from auth.users where id = '${utilizador}'`;
  const saida = execSync(`${comando} db query --linked -o json "${sql}"`, {
    cwd: RAIZ,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    timeout: 120_000,
  });
  const token = /"token":\s*"([^"]*)"/.exec(saida)?.[1] ?? "";
  if (!token) {
    // Visto a 2 nov: com o SMTP por omissão do Supabase Auth, o projeto só
    // envia meia dúzia de e-mails de autenticação por hora — depois disso o
    // pedido falha com "429 over_email_send_rate_limit" e não fica token
    // nenhum. Não é o teste a falhar: é o registo e a recuperação reais a
    // falharem para quem vier a seguir. O remédio é o SMTP próprio (Resend).
    throw new Error(
      `Sem ${coluna}: o Supabase não enviou o e-mail. Se o SMTP do Auth ainda for o ` +
        "por omissão, o limite de e-mails por hora esgotou-se (429) — é o bloqueador " +
        "do SMTP próprio, não um defeito do teste.",
    );
  }
  return token;
}

export const tokenDeRecuperacao = (utilizador: string) =>
  tokenDeEmail(utilizador, "recovery_token");

/** O link de verificação que o e-mail traria. */
export function linkDeVerificacao(
  token: string,
  tipo: "recovery" | "signup",
  redirecionar: string,
): string {
  const url = new URL(`${SUPABASE_URL}/auth/v1/verify`);
  url.searchParams.set("token", token);
  url.searchParams.set("type", tipo);
  url.searchParams.set("redirect_to", redirecionar);
  return url.toString();
}
