/**
 * Os textos que os testes procuram no ecrã vêm do `pt.json`
 * =========================================================================
 * Um teste que escreve "Entrar" à mão parte no dia em que alguém muda o botão
 * para "Iniciar sessão" — e ensina a desligar o teste. Lido do ficheiro de
 * mensagens, o teste segue a app.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PT = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../config/messages/pt.json", import.meta.url)), "utf8"),
) as Record<string, unknown>;

/** `t("auth.login.email")` → o texto em pt. Atira se a chave não existir. */
export function t(chave: string): string {
  let no: unknown = PT;
  for (const parte of chave.split(".")) {
    if (no && typeof no === "object" && parte in (no as Record<string, unknown>)) {
      no = (no as Record<string, unknown>)[parte];
    } else {
      throw new Error(`Mensagem em falta em pt.json: ${chave}`);
    }
  }
  if (typeof no !== "string") throw new Error(`Não é texto: ${chave}`);
  return no;
}
