/**
 * Cenário 3 do A4 — o proprietário cria e preenche um anúncio
 * =========================================================================
 * O caminho de escrita: rascunho, os passos do assistente (identificação,
 * preço) e a lista "As minhas propriedades". As escritas vão pelo PostgREST,
 * com a sessão do proprietário — as mesmas tabelas, a mesma RLS e os mesmos
 * gatilhos (auditoria A8, limites do plano) que as Server Actions usam. O
 * que fica de fora é a camada Next da ação, que é fina; e o upload de
 * fotografias, que mede o Storage e não a base.
 *
 * Fica em rascunho, de propósito: publicar dispara a moderação, e um teste
 * de carga não pode encher a fila de quem modera.
 *
 *   k6 run -e ALVO_APP=… -e SUPABASE_URL=… -e SUPABASE_ANON_KEY=… \
 *          -e SUPABASE_SERVICE_ROLE_KEY=… packages/carga/cenarios/publicacao.js
 */
import { check, group, sleep } from "k6";
import http from "k6/http";

import { cabecalhos, confirmarAlvo, env, etapas, exigir } from "../lib/ambiente.js";
import { apagarContas, cookieDeSessao, criarContas } from "../lib/contas.js";

export const options = {
  ...etapas(),
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{passo:escrita}": ["p(95)<800"],
    "http_req_duration{passo:lista}": ["p(95)<1500"],
  },
};

const CONTAS = env.perfil === "fumo" ? 1 : 10;

export function setup() {
  exigir("app", "supabase", "anon", "servico");
  confirmarAlvo();
  return { contas: criarContas("owner", CONTAS, "publicacao") };
}

export default function ({ contas }) {
  const dono = contas[(__VU + __ITER) % contas.length];
  const api = {
    headers: { ...cabecalhos(dono.sessao.access_token), Prefer: "return=representation" },
    tags: { passo: "escrita" },
  };

  group("publicação", () => {
    const rascunho = http.post(
      `${env.supabase}/rest/v1/properties`,
      JSON.stringify({ owner_id: dono.id, deal: "sale", status: "draft", typology: "T1" }),
      api,
    );
    check(rascunho, { "rascunho criado": (r) => r.status === 201 });
    const id = rascunho.status === 201 ? JSON.parse(rascunho.body)[0].id : null;
    if (!id) return;
    sleep(2);

    const identificacao = http.patch(
      `${env.supabase}/rest/v1/properties?id=eq.${id}&owner_id=eq.${dono.id}`,
      JSON.stringify({
        title: `Carga ${__VU}-${__ITER}`,
        property_type: "Apartamento",
        typology: "T2",
        condition: "Usado — bom estado",
        description: "Anúncio criado pelo teste de carga.",
      }),
      api,
    );
    check(identificacao, { "identificação gravada": (r) => r.status === 200 });
    sleep(3);

    const preco = http.patch(
      `${env.supabase}/rest/v1/properties?id=eq.${id}&owner_id=eq.${dono.id}`,
      JSON.stringify({ price_cents: 25_000_000 }),
      api,
    );
    check(preco, { "preço gravado": (r) => r.status === 200 });
    sleep(2);

    const lista = http.get(`${env.app}/propriedades`, {
      headers: { Cookie: cookieDeSessao(dono.sessao) },
      tags: { passo: "lista" },
      redirects: 0,
    });
    check(lista, { "lista 200 (sessão aceite)": (r) => r.status === 200 });
    sleep(2);
  });
}

export function teardown({ contas }) {
  apagarContas(contas);
}
