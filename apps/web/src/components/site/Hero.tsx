import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { HERO_STAT_IDS, SITE_IMAGES } from "../../lib/site-content";
import { SiteImage } from "./SiteImage";
import "./site.css";

/**
 * Hero do site público (P2-01 · 04 §2.1)
 * =========================================================================
 * Texto do protótipo, com uma correção: o CTA primário dizia "Criar conta
 * grátis" e não há conta grátis desde P9-05 — ver a nota em `site-content.ts`.
 *
 * O destino do CTA muda com `launch_mode` (03 §1.1): em pré-lançamento leva à
 * pré-inscrição, em pós-lançamento ao registo. É o único sítio do hero que
 * depende da flag, e por isso é a única coisa que entra por prop.
 *
 * **A fotografia vai até à margem** (6 nov 2026, como no site de
 * pré-lançamento anterior): a coluna da imagem não fica presa à largura do
 * site, ocupa a metade direita do ecrã de cima a baixo. O texto alinha-se com
 * o das outras secções — a mesma margem, a de `site.css`. Abaixo de 900 px
 * de página a imagem passa para baixo do texto, em largura total.
 */
export function Hero({ launchMode }: { launchMode: "pre" | "post" }) {
  const t = useTranslations("site.hero");
  const primaryHref = launchMode === "pre" ? "/pre-inscricao" : "/criar-conta";

  return (
    <section className="upm-hero">
      {/* A grelha está em `site.css` (".upm-hero"): quatro faixas medidas pela
          própria secção, para a storyboard e o site serem a mesma página. */}
      <div className="upm-hero__grid">
        <div className="upm-hero__text">
          {/* Dois blocos (cliente, 8 nov 2026): o principal — eyebrow, título,
              texto e botões — ao centro, e os três números no fundo da
              coluna, ao nível da base da fotografia. Ver `site.css`. */}
          <div className="upm-hero__main" style={{ rowGap: "16px" }}>
            <span
              style={{
                // Sobretítulo a 13 px em JetBrains Mono (cliente, 11 nov 2026):
                // exceção ao mínimo de 14 px do site, registada em `tokens.css`.
                fontFamily: "var(--font-mono)",
                fontSize: "13px",
                fontWeight: "var(--fw-semibold)",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--accent)",
                // O bloco separa tudo a 16 px; o eyebrow encosta mais ao
                // título, com o valor afinado no canvas (cliente, 8 nov 2026).
                marginTop: "0px",
                marginBottom: "-14px",
              }}
            >
              {t("eyebrow")}
            </span>
            {/* O tamanho está em `site.css` (`.upm-hero__title`): depende da
              largura da coluna, e só uma regra de container a conhece. */}
            <h1
              className="upm-hero__title"
              style={{
                margin: 0,
                fontFamily: "var(--font-display)",
                lineHeight: 1.08,
                color: "var(--text)",
              }}
            >
              {/* "sem comissões" na cor primária (cliente, 8 nov 2026). O
                destaque vem marcado na mensagem (`<accent>`), para cair no
                sítio certo nas duas línguas. */}
              {t.rich("title", {
                accent: (chunks) => <span style={{ color: "var(--accent)" }}>{chunks}</span>,
              })}
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "16px",
                lineHeight: 1.6,
                color: "var(--muted)",
                maxWidth: "34rem",
              }}
            >
              {t("body")}
            </p>

            <div
              style={{
                display: "flex",
                gap: "var(--sp-3)",
                flexWrap: "wrap",
                // Um pouco mais de ar entre o texto e os botões (cliente, 8 nov).
                marginTop: "var(--sp-2)",
              }}
            >
              {/* Links com as classes do botão, não `<Button>`: o destino é uma
              navegação e tem de ser uma âncora real — para abrir em
              separador novo, para o teclado e para os motores de busca.
              É o mesmo padrão de `guardados/page.tsx` e
              `conta-suspensa/page.tsx`. */}
              <Link href={primaryHref} className="upm-btn upm-btn--primary upm-btn--md">
                {t("primaryCta")}
              </Link>
              <a href="#plataforma" className="upm-btn upm-btn--secondary upm-btn--md">
                {t("secondaryCta")}
              </a>
            </div>
          </div>

          <ul
            className="upm-hero__stats"
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--sp-3) var(--sp-6)",
            }}
          >
            {HERO_STAT_IDS.map((statId) => (
              <li
                key={statId}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "var(--sp-2)",
                  fontSize: "var(--fs-body)",
                  // `--fw-medium` (500) e não `--fw-semibold` (600): estes três
                  // números acompanham o hero, não competem com ele.
                  fontWeight: "var(--fw-medium)",
                  color: "var(--text)",
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "var(--r-pill)",
                    background: "var(--accent)",
                  }}
                />
                {t(`stats.${statId}`)}
              </li>
            ))}
          </ul>
        </div>

        <div className="upm-hero__media">
          <SiteImage image={SITE_IMAGES.hero} label={t("imageLabel")} rounded={false} priority />
        </div>
      </div>
    </section>
  );
}
