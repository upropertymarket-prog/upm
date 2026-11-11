import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Brand } from "@upm/ui";
import { Instagram, Youtube } from "lucide-react";

import { FOOTER_COLUMNS, SOCIAL_LINKS } from "../../lib/site-content";
import "./site.css";

/**
 * Rodapé: marca à esquerda, navegação à direita (P2-01 · 04 §2.1)
 * =========================================================================
 * A marca de um lado, as quatro colunas do protótipo encostadas ao outro, com
 * o espaço livre a cair todo no meio. A última coluna — Termos,
 * Privacidade, Cookies — não é decoração: P11-07 exige que as páginas legais
 * estejam ligadas de forma clara **antes** de se recolher um único lead, e
 * este rodapé é o que cumpre essa ligação em todas as páginas do site.
 *
 * As âncoras (`#sobre`, `#precos`) só funcionam na home. Num site de uma
 * página só isso chega; quando houver `/propriedades`, passam a `/#sobre`.
 *
 * `launchMode` esconde os links que só existem depois do lançamento
 * (`postOnly`, hoje o "Já tenho conta"). Por omissão `pre`: quem não o
 * passa (o 404, a página de erro) esconde, em vez de mostrar um link que em
 * pré-lançamento volta à home.
 */
export function SiteFooter({ launchMode = "pre" }: { launchMode?: "pre" | "post" }) {
  const t = useTranslations("site.footer");
  const redes = (
    [
      { id: "instagram", href: SOCIAL_LINKS.instagram, Icon: Instagram },
      { id: "youtube", href: SOCIAL_LINKS.youtube, Icon: Youtube },
    ] as const
  ).filter((rede) => rede.href !== "");

  return (
    <footer
      className="upm-site-section"
      style={{
        background: "var(--surface2)",
        borderTop: "1px solid var(--border)",
      }}
    >
      {/* A largura e as margens são as das secções (`site.css`): a marca do
          rodapé alinha com o texto de cima. A altura é a do `cc-footer` do
          MAST (4rem em cima, 2rem em baixo), no lugar da das secções. */}
      {/* 11 nov 2026: 40 px do último link à linha (eram 16), e a linha do
          copyright com o mesmo espaço em cima e em baixo — centrada entre o
          traço e o fim do rodapé. O fundo do contentor passa para essa linha. */}
      <div
        className="upm-site-container"
        style={{ display: "grid", gap: "var(--site-gap)", paddingBlock: "4rem 0" }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "var(--sp-6)",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: "var(--sp-3)",
              alignContent: "start",
              flex: "0 1 18rem",
            }}
          >
            <Brand />
            <p
              style={{
                margin: 0,
                fontSize: "var(--fs-body)",
                color: "var(--muted)",
                maxWidth: "18rem",
              }}
            >
              {t("tagline")}
            </p>
          </div>

          {/* As quatro colunas viajam juntas, encostadas à direita: o
              `space-between` do pai só separa a marca deste bloco. Sem media
              queries — o `flex-wrap` quebra sozinho quando falta largura.
              O bloco encosta à direita pela margem automática, não pelo
              `justify-content`: assim, quando uma coluna cai para a linha de
              baixo, alinha-se à esquerda das irmãs em vez de ficar sozinha no
              canto com um buraco ao lado. */}
          {/* As colunas e o alinhamento estão em `site.css`
              (`.upm-site-footer__cols`): no telemóvel ficam uma por baixo da
              outra (11 nov 2026), e isso pede uma container query. */}
          <div
            className="upm-site-footer__cols"
            style={{
              display: "grid",
              alignItems: "start",
              gap: "var(--sp-6)",
              flex: "1 1 22rem",
            }}
          >
            {FOOTER_COLUMNS.map((column) => (
              <nav
                key={column.id}
                aria-label={t(`columns.${column.id}.title`)}
                style={{
                  display: "grid",
                  gap: "var(--sp-3)",
                  alignContent: "start",
                }}
              >
                <strong
                  style={{
                    fontSize: "var(--fs-label)",
                    fontWeight: "var(--fw-semibold)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "var(--muted)",
                  }}
                >
                  {t(`columns.${column.id}.title`)}
                </strong>
                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    padding: 0,
                    display: "grid",
                    gap: "var(--sp-2)",
                  }}
                >
                  {column.links
                    .filter(
                      (link) => launchMode === "post" || !("postOnly" in link && link.postOnly),
                    )
                    .map((link) => (
                      <li key={link.id}>
                        {/* `"route" in link` e não `href.startsWith("#")`: uma
                          âncora da mesma página e uma rota do site são coisas
                          diferentes — só a segunda leva prefixo de idioma — e
                          o compilador distingue-as por nome de campo, que um
                          `startsWith` sobre uma união de literais não faz. */}
                        {"route" in link ? (
                          <Link
                            href={link.route}
                            style={{ fontSize: "var(--fs-body)", color: "var(--text)" }}
                          >
                            {t(`columns.${column.id}.links.${link.id}`)}
                          </Link>
                        ) : (
                          <a
                            href={link.anchor}
                            style={{ fontSize: "var(--fs-body)", color: "var(--text)" }}
                          >
                            {t(`columns.${column.id}.links.${link.id}`)}
                          </a>
                        )}
                      </li>
                    ))}
                </ul>
              </nav>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--sp-4)",
            justifyContent: redes.length > 0 ? "space-between" : "center",
            alignItems: "center",
            paddingBlock: "var(--sp-9)",
            borderTop: "1px solid var(--border)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: "var(--fs-body)",
              color: "var(--muted)",
              // Centrado no canvas a 12 out 2026: é a última linha do rodapé,
              // sozinha debaixo do traço, e alinhada à esquerda ficava a puxar
              // o olho para um canto sem nada do outro lado.
              textAlign: "center",
            }}
          >
            {t("copyright")}
          </p>
          {redes.length > 0 ? (
            <nav aria-label={t("social.label")} style={{ display: "flex", gap: "var(--sp-4)" }}>
              {redes.map(({ id, href, Icon }) => (
                <a
                  key={id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t(`social.${id}`)}
                  style={{ color: "var(--muted)", display: "inline-flex" }}
                >
                  <Icon size={20} aria-hidden="true" />
                </a>
              ))}
            </nav>
          ) : null}
        </div>
      </div>
    </footer>
  );
}
