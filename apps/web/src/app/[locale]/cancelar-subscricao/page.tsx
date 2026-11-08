import { getLocale, getTranslations } from "next-intl/server";
import { createAnonClient } from "@upm/db/server";
import { unsubscribeByToken } from "@upm/db/campaigns";

import { pageMetadata } from "@/lib/seo-overrides";
import { seo } from "./seo";

import { PublicHeader } from "@/components/PublicHeader";
import { SectionHeading, SiteSection } from "@/components/site/SiteSection";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getLaunchMode } from "@/lib/launch-mode";

export function generateMetadata() {
  return pageMetadata(seo, { pathname: "/cancelar-subscricao" });
}

/**
 * `/cancelar-subscricao` — o destino do link que 02 §4.3 exige (P10-08)
 * =========================================================================
 * Toda a campanha leva este link no rodapé, posto pelo renderizador e não pelo
 * construtor — deixá-lo editável era deixá-lo apagável. Esta é a página do
 * outro lado dele.
 *
 * ## Cancela ao abrir, e isso é uma decisão
 *
 * Não há botão de confirmação. Quem clica em "cancelar subscrição" dentro de um
 * e-mail já decidiu; pedir uma segunda confirmação numa página é pôr um
 * obstáculo entre a pessoa e um direito que ela exerceu. É também o que o
 * `List-Unsubscribe-Post: One-Click` promete ao Gmail e ao Outlook, que fazem
 * este pedido **sozinhos** quando o utilizador usa o botão deles — se a página
 * exigisse um clique nosso, esse caminho não cancelava nada.
 *
 * O risco conhecido de cancelar num `GET` é um pré-carregador de links abrir o
 * URL sem ninguém o pedir. Aqui isso é aceitável e a troca é consciente: o
 * token é de um destinatário só, o efeito é "deixar de receber marketing" — não
 * destrutivo e reversível pela própria pessoa nas Definições — e o custo do
 * erro oposto, um cancelamento que não cancela, é uma queixa de RGPD.
 *
 * ## Sem sessão, de propósito
 *
 * `createAnonClient` e uma função `security definer` que aceita `anon`: o token
 * é a identidade (`20261015140000`). Exigir login para cancelar uma subscrição
 * era exigir uma conta para exercer um direito — e metade dos destinatários de
 * uma campanha a leads do site nem conta têm.
 */
export const dynamic = "force-dynamic";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const [locale, launchMode, params] = await Promise.all([
    getLocale(),
    getLaunchMode(),
    searchParams,
  ]);
  const t = await getTranslations("site.unsubscribe");

  const token = (params.t ?? "").trim();
  const feito = token ? await unsubscribeByToken(createAnonClient(), token) : false;

  const texto = feito
    ? { eyebrow: t("eyebrow"), title: t("okTitle"), body: t("okBody") }
    : { eyebrow: t("eyebrow"), title: t("badTitle"), body: t("badBody") };

  return (
    <>
      <PublicHeader locale={locale} launchMode={launchMode} />

      <main>
        <SiteSection>
          <div style={{ display: "grid", gap: "var(--sp-6)", maxWidth: "min(100%, 44rem)" }}>
            <SectionHeading eyebrow={texto.eyebrow} title={texto.title} body={texto.body} />
          </div>
        </SiteSection>
      </main>

      <SiteFooter launchMode={launchMode} />
    </>
  );
}
