import { createAnonClient } from "./server";

/**
 * Verificação de saúde das apps (12 §9.1 · bloqueador B2)
 * ===========================================================================
 * O que um monitor externo bate de minuto a minuto para saber se a app está
 * viva. Existe porque, até 29 out 2026, **nenhuma das três apps tinha onde ser
 * batida**: o primeiro a saber que algo caiu era um cliente ao telefone — ou
 * ninguém, durante um fim de semana.
 *
 * ## Verifica a base de dados, não só o processo
 *
 * Uma rota que devolve `200 OK` sem tocar em mais nada só prova que o Node
 * está de pé. Uma app viva **sem base de dados** está em baixo para quem a
 * usa: os ecrãs carregam e ficam vazios, os formulários falham, e o monitor
 * continua a dizer verde. Por isso a verificação faz uma leitura real pelo
 * mesmo caminho que um visitante faz — cliente anónimo, PostgREST, RLS.
 *
 * ## Público, mas mudo
 *
 * Decidido a 29 out 2026. O endpoint não leva token: um monitor com segredo é
 * um segredo a mais para guardar e rodar, e o atrito não compensa. Mas a
 * resposta **não diz o que falhou** — `{ ok: false }` e um 503, nada mais.
 *
 * A razão é a de 08 §3.6, a mesma do webhook do Stripe: dar o alarme sem dar o
 * mapa. Saber que a app respondeu ou não é informação pública de qualquer
 * maneira — basta visitá-la. Saber **que é a base de dados que está em baixo**,
 * e não o processo, é reconhecimento gratuito para quem anda a sondar. O
 * detalhe vai para o log do servidor, onde é útil a quem o vai resolver.
 *
 * ## Falha fechada, e depressa
 *
 * O `AbortSignal.timeout` existe para o caso mais feio: a base de dados não
 * recusa a ligação, aceita-a e não responde. Sem limite, a verificação fica
 * pendurada, o monitor expira por conta dele e o relatório diz "timeout" em
 * vez de "503" — a mesma conclusão por um caminho mais lento e menos claro.
 * Quatro segundos é folgado para uma leitura de uma linha e aperta o
 * suficiente para caber dentro do limite de qualquer monitor.
 */

/** Uma leitura barata, por uma tabela pequena que o `anon` já alcança. */
const TABELA_SONDA = "app_settings" as const;

const TIMEOUT_MS = 4000;

export type EstadoDeSaude = {
  /** A única coisa que sai para fora. */
  ok: boolean;
  /** Para o log do servidor — nunca para a resposta. */
  detalhe?: string;
};

export async function checkHealth(): Promise<EstadoDeSaude> {
  let supabase;
  try {
    supabase = createAnonClient();
  } catch (erro) {
    // Falta configuração. É um 503 legítimo: a app não serve ninguém assim.
    return { ok: false, detalhe: mensagem(erro) };
  }

  try {
    const { error } = await supabase
      .from(TABELA_SONDA)
      .select("key")
      .limit(1)
      .abortSignal(AbortSignal.timeout(TIMEOUT_MS));

    if (error) return { ok: false, detalhe: error.message };
    return { ok: true };
  } catch (erro) {
    // `AbortSignal.timeout` atira `TimeoutError` — e qualquer falha de rede
    // cai aqui também. Para o monitor é tudo a mesma coisa: não está bom.
    return { ok: false, detalhe: mensagem(erro) };
  }
}

function mensagem(erro: unknown): string {
  return erro instanceof Error ? erro.message : "erro desconhecido";
}

/**
 * A resposta HTTP, igual nas três apps.
 *
 * `no-store` não é detalhe: sem ele, uma CDN ou o próprio Next podem servir
 * um `200` guardado enquanto a app está em baixo — e o monitor fica a ver uma
 * fotografia em vez da app.
 */
export function healthResponse(estado: EstadoDeSaude, app: string): Response {
  if (!estado.ok) {
    console.error(`[${app}] health: ${estado.detalhe ?? "sem detalhe"}`);
  }

  return Response.json(
    { ok: estado.ok },
    {
      status: estado.ok ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        // Não é um ecrã, e não há nada para um browser interpretar.
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
