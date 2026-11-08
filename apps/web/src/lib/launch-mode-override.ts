export type LaunchMode = "pre" | "post";

/**
 * Forçar o modo, só fora de produção
 * =========================================================================
 * Há um projeto Supabase só (o "staging"), e o `launch_mode` dele é `pre`. Os
 * E2E que provam o registo e a entrada pelo `www` precisam do site em `post`;
 * o que prova o pré-lançamento precisa dele em `pre`. Trocar a flag na base a
 * meio de uma corrida mudava o site de quem estivesse a trabalhar, por isso o
 * servidor de testes diz o modo que quer em `UPM_LAUNCH_MODE_OVERRIDE`.
 *
 * **Nunca em produção:** `next build`/`next start` e a Vercel correm sempre com
 * `NODE_ENV=production`, e aí a variável é ignorada. Uma variável esquecida no
 * painel não abre o registo antes de tempo — o modo continua a vir da base.
 */
export function modoForcado(): LaunchMode | null {
  if (process.env.NODE_ENV === "production") return null;
  const valor = process.env.UPM_LAUNCH_MODE_OVERRIDE;
  return valor === "pre" || valor === "post" ? valor : null;
}
