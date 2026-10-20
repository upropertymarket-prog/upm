import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { HERO_STAT_IDS } from "../../lib/site-content";
import { SITE_MAX_WIDTH } from "./SiteSection";

/**
 * Hero do site público (P2-01 · 04 §2.1)
 * =========================================================================
 * Texto do protótipo, com uma correção: o CTA primário dizia "Criar conta
 * grátis" e não há conta grátis desde P9-05 — ver a nota em `site-content.ts`.
 *
 * O destino do CTA muda com `launch_mode` (03 §1.1): em pré-lançamento leva à
 * pré-inscrição, em pós-lançamento ao registo. É o único sítio do hero que
 * depende da flag, e por isso é a única coisa que entra por prop.
 */
export function Hero({ launchMode }: { launchMode: "pre" | "post" }) {
  const t = useTranslations("site.hero");
  const primaryHref = launchMode === "pre" ? "/pre-inscricao" : "/criar-conta";

  return (
    <section
      style={{
        background: "var(--bg)",
        padding: "clamp(2rem, 5vw, 4.5rem) 16px clamp(2.5rem, 6vw, 5rem)",
      }}
    >
      <div
        style={{
          maxWidth: SITE_MAX_WIDTH,
          margin: "0 auto",
          display: "grid",
          // Duas colunas acima de ~56rem e uma abaixo, sem media query.
          gridTemplateColumns: "repeat(auto-fit, minmax(min(26rem, 100%), 1fr))",
          gap: "clamp(1.5rem, 4vw, 3rem)",
          alignItems: "center",
        }}
      >
        <div style={{ display: "grid", gap: "var(--sp-5)" }}>
          <span
            style={{
              // Token e não um valor à mão: `[data-app="web"]` põe
              // `--fs-label` nos 14 px que 07 §3 fixa como mínimo do site
              // público. Escrever "12px" aqui furava esse piso.
              fontSize: "var(--fs-label)",
              fontWeight: 800,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--accent)",
            }}
          >
            {t("eyebrow")}
          </span>
          <h1
            style={{
              margin: 0,
              fontFamily: "var(--font-display)",
              // 28 → 56 px: o topo da escala de 04 §1.3.
              fontSize: "clamp(1.75rem, 5.2vw, 3.5rem)",
              lineHeight: 1.08,
              color: "var(--text)",
            }}
          >
            {t("title")}
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

          <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
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

          <ul
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
                  fontWeight: 700,
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

        {/* Espaço reservado da fotografia principal. Fica declarado e com
            proporção fixa para o layout não saltar quando a imagem real
            entrar — e com o rótulo que o protótipo lhe dá, para não parecer
            um erro a quem vê o ecrã antes de haver fotografia. */}
        <div
          role="img"
          aria-label={t("imageLabel")}
          style={{
            aspectRatio: "4 / 3",
            borderRadius: "var(--r-lg)",
            border: "1px solid var(--border)",
            background: "var(--surface2)",
            display: "grid",
            placeItems: "center",
            color: "var(--muted)",
            fontSize: "var(--fs-body)",
          }}
        >
          {t("imageLabel")}
        </div>
      </div>
    </section>
  );
}
