/**
 * Cenário 1 do A4 — o catálogo público, sem conta
 * =========================================================================
 * O que um visitante faz e o que o Google lê: a home, o catálogo, um filtro
 * e a ficha de um anúncio. É a parte do site com cache (A2, F2), por isso o
 * número que interessa é o p95 com a cache quente — e a taxa de erro quando a
 * cache expira debaixo de carga.
 *
 *   k6 run -e ALVO_WEB=… -e SUPABASE_URL=… -e SUPABASE_ANON_KEY=… \
 *          packages/carga/cenarios/catalogo.js
 */
import { check, group, sleep } from "k6";
import http from "k6/http";

import { cabecalhos, confirmarAlvo, env, etapas, exigir } from "../lib/ambiente.js";

export const options = {
  ...etapas(),
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{pagina:home}": ["p(95)<800"],
    "http_req_duration{pagina:catalogo}": ["p(95)<1000"],
    "http_req_duration{pagina:ficha}": ["p(95)<1000"],
  },
};

export function setup() {
  exigir("web", "supabase", "anon");
  confirmarAlvo();
  // Os anúncios que o site mostra, pela mesma vista que ele lê (como `anon`).
  const r = http.get(`${env.supabase}/rest/v1/properties_public?select=id,city&limit=50`, {
    headers: cabecalhos(),
  });
  const anuncios = JSON.parse(r.body || "[]");
  if (!Array.isArray(anuncios) || anuncios.length === 0) {
    throw new Error("O alvo não tem anúncios publicados: o cenário não mede nada.");
  }
  return { anuncios };
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
