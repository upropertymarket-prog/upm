import { modoForcado, type LaunchMode } from "./launch-mode-override";

/**
 * O modo, lido pelo middleware
 * =========================================================================
 * O middleware corre no runtime de borda, onde o `unstable_cache` de
 * `launch-mode.ts` não existe. Lê a flag pela API REST do Supabase, com a
 * chave pública — a mesma leitura que o site já faz, e que a política de
 * `feature_flags` deixa ao anon — e guarda-a 30 s em memória.
 *
 * **O custo dos 30 s:** quando o Admin passar a `post`, o redirecionamento pode
 * demorar até meio minuto a largar o registo, em cada instância. É o sentido
 * seguro: o erro caro é abrir cedo, não abrir 30 s tarde.
 *
 * **Falha fechada**, como em `launch-mode.ts`: sem resposta da base, `pre`. A
 * falha só se guarda 5 s, para o site não ficar meio minuto fechado por um
 * soluço da rede.
 */
let guardado: { modo: LaunchMode; ate: number } | null = null;

export async function modoNoMiddleware(): Promise<LaunchMode> {
  const forcado = modoForcado();
  if (forcado) return forcado;

  const agora = Date.now();
  if (guardado && guardado.ate > agora) return guardado.modo;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let modo: LaunchMode = "pre";
  let lido = false;
  if (url && chave) {
    try {
      const resposta = await fetch(`${url}/rest/v1/feature_flags?select=value&key=eq.launch_mode`, {
        headers: { apikey: chave, Authorization: `Bearer ${chave}` },
        cache: "no-store",
        signal: AbortSignal.timeout(2_000),
      });
      if (resposta.ok) {
        const linhas = (await resposta.json()) as Array<{ value: unknown }>;
        modo = linhas[0]?.value === "post" ? "post" : "pre";
        lido = true;
      }
    } catch {
      // Fica `pre`.
    }
  }
  guardado = { modo, ate: agora + (lido ? 30_000 : 5_000) };
  return modo;
}
