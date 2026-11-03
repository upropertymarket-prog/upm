/**
 * Cenário 1 do A4 — o catálogo público, sem conta
 * =========================================================================
 * O que um visitante faz e o que o Google lê: a home, o catálogo, um filtro
 * e a ficha de um anúncio. É a parte do site com cache (A2, F2), por isso o
 * número que interessa é o p95 com a cache quente — e a taxa de erro quando a
 * cache expira debaixo de carga.
 *
 * Publica os seus próprios anúncios no setup e apaga-os no teardown: não
 * depende do que estiver na base, e não deixa nada para trás.
 *
 *   k6 run -e ALVO_WEB=… -e SUPABASE_URL=… -e SUPABASE_ANON_KEY=… \
 *          -e SUPABASE_SERVICE_ROLE_KEY=… packages/carga/cenarios/catalogo.js
 */
import { check, group, sleep } from "k6";
import http from "k6/http";

import {
  cabecalhosDeServico,
  confirmarAlvo,
  env,
  etapas,
  exigir,
  latencias,
} from "../lib/ambiente.js";
import { apagarContas, criarContas } from "../lib/contas.js";

export const options = {
  ...etapas(),
  thresholds: {
    http_req_failed: ["rate<0.01"],
    // Um limiar sem pedidos passa por omissão (p95=0s): sem isto, um cenário
    // que rebenta a meio "passava" — visto no fumo de 3 nov. Cada página
    // medida tem de ter sido pedida, e as verificações têm de passar (todas no
    // fumo; sob carga, um erro isolado é o próprio resultado a medir).
    checks: [env.perfil === "fumo" ? "rate==1" : "rate>0.99"],
    "http_reqs{pagina:home}": ["count>0"],
    "http_reqs{pagina:catalogo}": ["count>0"],
    "http_reqs{pagina:ficha}": ["count>0"],
    ...latencias({
      "http_req_duration{pagina:home}": ["p(95)<800"],
      "http_req_duration{pagina:catalogo}": ["p(95)<1000"],
      "http_req_duration{pagina:ficha}": ["p(95)<1000"],
    }),
  },
};

// Quantos anúncios o cenário publica para si. Um catálogo vazio não mede nada —
// e o cenário não pode depender do que estiver na base (a 3 nov não havia
// nenhum anúncio real em staging, só restos dos E2E, entretanto limpos).
const ANUNCIOS = env.perfil === "fumo" ? 3 : 30;
const CIDADES = ["Lisboa", "Porto", "Braga", "Faro", "Coimbra"];

export function setup() {
  exigir("web", "supabase", "anon", "servico");
  confirmarAlvo();
  // Um proprietário e os seus anúncios, já publicados — o estado de quem
  // passou a moderação. Pela chave de serviço, como os E2E fazem.
  const [dono] = criarContas("owner", 1, "catalogo");
  const linhas = Array.from({ length: ANUNCIOS }, (_, i) => ({
    owner_id: dono.id,
    ref: `CARGA-${Date.now()}-${i}`,
    title: `Carga ${i} — T2 em ${CIDADES[i % CIDADES.length]}`,
    deal: i % 3 === 0 ? "rent" : "sale",
    status: "active",
    property_type: "Apartamento",
    typology: "T2",
    condition: "Usado — bom estado",
    description: "Anúncio criado pelo teste de carga.",
    price_cents: 20_000_000 + i * 1_000_000,
    rent_cents: 120_000 + i * 1_000,
    city: CIDADES[i % CIDADES.length],
    published_at: new Date().toISOString(),
  }));
  const r = http.post(`${env.supabase}/rest/v1/properties`, JSON.stringify(linhas), {
    headers: { ...cabecalhosDeServico(), Prefer: "return=representation" },
  });
  if (r.status !== 201) {
    apagarContas([dono]);
    throw new Error(`Falha a publicar os anúncios do cenário: HTTP ${r.status} ${r.body}`);
  }
  const anuncios = JSON.parse(r.body).map((a) => ({ id: a.id, city: a.city }));
  return { anuncios, contas: [dono] };
}

export function teardown({ contas }) {
  apagarContas(contas);
}

export default function ({ anuncios }) {
  const anuncio = anuncios[Math.floor(Math.random() * anuncios.length)];

  group("visitante", () => {
    const home = http.get(`${env.web}/`, { tags: { pagina: "home" } });
    check(home, { "home 200": (r) => r.status === 200 });
    sleep(1);

    const catalogo = http.get(`${env.web}/propriedades`, { tags: { pagina: "catalogo" } });
    check(catalogo, { "catálogo 200": (r) => r.status === 200 });
    sleep(1);

    if (anuncio.city) {
      const filtro = http.get(
        `${env.web}/propriedades?cidade=${encodeURIComponent(anuncio.city)}`,
        { tags: { pagina: "catalogo" } },
      );
      check(filtro, { "filtro 200": (r) => r.status === 200 });
      sleep(1);
    }

    // `x-<uuid>` resolve pelo uuid e redireciona para o slug canónico.
    const ficha = http.get(`${env.web}/propriedades/x-${anuncio.id}`, {
      tags: { pagina: "ficha" },
    });
    check(ficha, { "ficha 200": (r) => r.status === 200 });
    sleep(2);
  });
}
