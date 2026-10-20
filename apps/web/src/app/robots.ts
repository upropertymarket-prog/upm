import type { MetadataRoute } from "next";

import { getLaunchMode } from "../lib/launch-mode";

/**
 * `robots.txt` do site público (P2-06 · 04 §2.1.1)
 * =========================================================================
 * **Em pré-lançamento o site inteiro vai fechado.** `Disallow: /` enquanto
 * `launch_mode` for `pre`, e é deliberado: o que está no ar nesse modo é uma
 * página de "em breve" e um formulário de pré-inscrição. Deixar o Google
 * indexar isso significa que, no dia do lançamento, o resultado de pesquisa da
 * marca é uma página que diz que o produto ainda não abriu — e sai do índice
 * devagar, muito depois de deixar de ser verdade. A mesma lógica que já põe
 * `noindex` em `/propriedades` nesse modo, aplicada ao site todo.
 *
 * Em pós-lançamento abre, com três exclusões:
 *
 *  - **`/entrar`, `/recuperar-palavra-passe`, `/criar-conta/verificacao`** —
 *    ecrãs transacionais, já `noindex` no respetivo `seo.ts`. O `noindex` é a
 *    instrução que conta; isto poupa ao robô o pedido.
 *  - **`/propriedades?...`** não se exclui. Os filtros geram combinações infinitas,
 *    mas quem resolve isso é o `canonical` da página, não um `Disallow` — uma
 *    página bloqueada no `robots.txt` não pode ser lida, e um robô que não a lê
 *    nunca vê o `canonical` que a aponta para a versão limpa.
 *
 * O `sitemap` só se anuncia em pós-lançamento: apontar um robô para o mapa de
 * um site que lhe acabámos de dizer para não ler é uma contradição.
 *
 * **Não cobre `app.` nem `interno.`** — são apps Next independentes, com os
 * seus próprios `robots`. O `interno` é `noindex` por outra via (04 §6).
 */
function siteUrl(): string {
  return (process.env.WEB_URL ?? "http://localhost:4300").replace(/\/+$/, "");
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const launchMode = await getLaunchMode();
  const base = siteUrl();

  if (launchMode === "pre") {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/entrar", "/recuperar-palavra-passe", "/criar-conta/verificacao"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
