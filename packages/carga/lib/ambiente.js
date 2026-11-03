/**
 * Teste de carga (A4 · 12 §25) — o ambiente e as salvaguardas
 * =========================================================================
 * Os cenários correm com o k6 (https://k6.io), não com o Node: `k6 run
 * packages/carga/cenarios/<cenário>.js`. Tudo o que muda entre corridas vem
 * de variáveis de ambiente (`-e NOME=valor`), nunca do código.
 *
 *   ALVO_WEB, ALVO_APP        URLs do `www` e do `app` (ex.: staging)
 *   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
 *                             o projeto por trás deles; a chave de serviço só
 *                             cria e apaga as contas de teste (setup/teardown)
 *   PERFIL                    fumo | carga | pico   (omissão: fumo)
 *   VUS                       utilizadores simultâneos no pico (omissão: 50)
 *   CONFIRMO_ALVO             tem de repetir o host de ALVO_APP — ver abaixo
 *
 * ## Porque há salvaguardas
 *
 * No outro projeto do cliente, uma base Nano caiu por excesso de carga. Este
 * projeto também está no Nano (12 §30): **carga a sério só depois de subir o
 * plano** (C8). O perfil `fumo` — 1 utilizador, 1 iteração — serve para
 * validar os cenários sem pesar nada; os outros exigem confirmação explícita
 * do alvo, para um comando copiado não ir parar ao sítio errado.
 */

export const env = {
  web: (__ENV.ALVO_WEB || "").replace(/\/$/, ""),
  app: (__ENV.ALVO_APP || "").replace(/\/$/, ""),
  supabase: (__ENV.SUPABASE_URL || "").replace(/\/$/, ""),
  anon: __ENV.SUPABASE_ANON_KEY || "",
  servico: __ENV.SUPABASE_SERVICE_ROLE_KEY || "",
  perfil: __ENV.PERFIL || "fumo",
  vus: Number(__ENV.VUS || 50),
};

export function exigir(...nomes) {
  const falta = nomes.filter((n) => !env[n]);
  if (falta.length) throw new Error(`Faltam variáveis: ${falta.join(", ")} (ver lib/ambiente.js)`);
}

/**
 * O host de um URL (`localhost:4401`, `abc.supabase.co`). À mão porque o k6
 * não tem o `URL` global do browser e do Node — foi o fumo de 3 nov que o
 * mostrou, com um `ReferenceError` a meio do cenário.
 */
export function hostDe(url) {
  const m = /^[a-z]+:\/\/([^/?#]+)/i.exec(url || "");
  return m ? m[1].toLowerCase() : "";
}

/** Recusa carga a sério sem o alvo confirmado por extenso. */
export function confirmarAlvo() {
  if (env.perfil === "fumo") return;
  const host = hostDe(env.app || env.web);
  if (__ENV.CONFIRMO_ALVO !== host) {
    throw new Error(
      `PERFIL=${env.perfil} pesa no alvo. Repita o host para confirmar: -e CONFIRMO_ALVO=${host}`,
    );
  }
}

/**
 * Os três perfis. `carga` é o dia normal; `pico` sobe até VUS, que é o
 * número da decisão D1 (pico alvo). Os patamares deixam ver onde parte.
 */
export function etapas() {
  if (env.perfil === "fumo") return { vus: 1, iterations: 1 };
  if (env.perfil === "carga") {
    return {
      stages: [
        { duration: "1m", target: 10 },
        { duration: "3m", target: 20 },
        { duration: "1m", target: 0 },
      ],
    };
  }
  const v = env.vus;
  return {
    stages: [
      { duration: "1m", target: Math.ceil(v / 4) },
      { duration: "2m", target: Math.ceil(v / 2) },
      { duration: "2m", target: v },
      { duration: "3m", target: v },
      { duration: "1m", target: 0 },
    ],
  };
}

/**
 * Limiares de latência, só fora do `fumo`. O fumo valida o cenário — que
 * cada passo corre e cada verificação passa —, e corre muitas vezes contra
 * `next dev`, que compila cada página na primeira visita (11 s no fumo de
 * 3 nov). Um p95 daí não diz nada da app; num alvo de staging, com carga, diz.
 */
export function latencias(limiares) {
  return env.perfil === "fumo" ? {} : limiares;
}

/** Cabeçalhos para falar com o PostgREST/Auth do Supabase. */
export function cabecalhos(token) {
  return {
    apikey: env.anon,
    Authorization: `Bearer ${token || env.anon}`,
    "Content-Type": "application/json",
  };
}

export function cabecalhosDeServico() {
  return {
    apikey: env.servico,
    Authorization: `Bearer ${env.servico}`,
    "Content-Type": "application/json",
  };
}
