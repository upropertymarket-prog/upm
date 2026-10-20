import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Brand } from "@upm/ui";

import { FOOTER_COLUMNS } from "../../lib/site-content";
import { SITE_MAX_WIDTH } from "./SiteSection";

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
 */
export function SiteFooter() {
  const t = useTranslations("site.footer");

  return (
    <footer
      style={{
        background: "var(--surface2)",
        borderTop: "1px solid var(--border)",
        padding: "clamp(2rem, 5vw, 3.5rem) 16px var(--sp-6)",
      }}
    >
      <div
        style={{ maxWidth: SITE_MAX_WIDTH, margin: "0 auto", display: "grid", gap: "var(--sp-7)" }}
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
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(9rem, 100%), max-content))",
              justifyContent: "end",
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
                    fontWeight: 800,
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
                  {column.links.map((link) => (
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

        <p
          style={{
            margin: 0,
            paddingTop: "var(--sp-5)",
            borderTop: "1px solid var(--border)",
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
      </div>
    </footer>
  );
}
