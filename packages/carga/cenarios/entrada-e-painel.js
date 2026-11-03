/**
 * Cenário 2 do A4 — com conta: o painel e as páginas do dia a dia
 * =========================================================================
 * O que pesa na base: cada página autenticada passa pelo middleware (sessão,
 * plano), lê os números do menu (`my_nav_counters`, F4) e a sua lista. Mede
 * o painel, as mensagens e a agenda, de proprietários e compradores.
 *
 * A entrada em si (o ecrã `/entrar`) não entra na carga: é limitada por IP no
 * Supabase Auth e na app, de propósito, e de um só computador mediria esse
 * limite. As sessões abrem-se no setup (ver `lib/contas.js`).
 *
 *   k6 run -e ALVO_APP=… -e SUPABASE_URL=… -e SUPABASE_ANON_KEY=… \
 *          -e SUPABASE_SERVICE_ROLE_KEY=… packages/carga/cenarios/entrada-e-painel.js
 */
import { check, group, sleep } from "k6";
import http from "k6/http";

import { confirmarAlvo, env, etapas, exigir } from "../lib/ambiente.js";
import { apagarContas, cookieDeSessao, criarContas } from "../lib/contas.js";

export const options = {
  ...etapas(),
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{pagina:painel}": ["p(95)<1500"],
    "http_req_duration{pagina:lista}": ["p(95)<1500"],
  },
};

// Contas suficientes para os utilizadores virtuais não partilharem todos a mesma.
const CONTAS_POR_PAPEL = env.perfil === "fumo" ? 1 : 10;

export function setup() {
  exigir("app", "supabase", "anon", "servico");
  confirmarAlvo();
  const contas = [
    ...criarContas("owner", CONTAS_POR_PAPEL, "painel"),
    ...criarContas("buyer", CONTAS_POR_PAPEL, "painel"),
  ];
  return { contas };
}

export default function ({ contas }) {
  const conta = contas[(__VU + __ITER) % contas.length];
  const params = (pagina) => ({
    headers: { Cookie: cookieDeSessao(conta.sessao) },
    tags: { pagina },
    redirects: 0,
  });

  group(conta.papel, () => {
    const painel = http.get(`${env.app}/painel`, params("painel"));
    // 200 e não 307: um redirecionamento aqui é a sessão recusada, não carga.
    check(painel, { "painel 200 (sessão aceite)": (r) => r.status === 200 });
    sleep(2);

    const mensagens = http.get(`${env.app}/mensagens`, params("lista"));
    check(mensagens, { "mensagens 200": (r) => r.status === 200 });
    sleep(2);

    const agenda = conta.papel === "owner" ? "/agenda" : "/meus-pedidos";
    const visitas = http.get(`${env.app}${agenda}`, params("lista"));
    check(visitas, { "visitas 200": (r) => r.status === 200 });
    sleep(3);
  });
}

export function teardown({ contas }) {
  apagarContas(contas);
}
