import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";

import { HERO_STAT_IDS, SITE_IMAGES } from "../../lib/site-content";
import { SiteImage } from "./SiteImage";

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
 * o resto da página pelo `padding` da esquerda, que é a mesma margem que o
 * `SiteSection` deixa a 1200 px. Abaixo de ~56rem a imagem passa para baixo
 * do texto, em largura total.
 */
export function Hero({ launchMode }: { launchMode: "pre" | "post" }) {
  const t = useTranslations("site.hero");
  const primaryHref = launchMode === "pre" ? "/pre-inscricao" : "/criar-conta";

  return (
    <section
      style={{
        background: "var(--bg)",
        display: "grid",
        // Duas colunas acima de ~56rem e uma abaixo, sem media query.
        gridTemplateColumns: "repeat(auto-fit, minmax(min(28rem, 100%), 1fr))",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "var(--sp-5)",
          alignContent: "center",
          maxWidth: "40rem",
          justifySelf: "end",
          width: "100%",
          boxSizing: "border-box",
          // À direita, a distância à fotografia; à esquerda, a margem da
          // página: metade do que sobra dos 1200 px do site, nunca menos de 16.
          padding:
            "clamp(2.5rem, 7vw, 6rem) clamp(1.5rem, 4vw, 3.5rem) clamp(2.5rem, 7vw, 6rem) max(16px, calc((100vw - 1200px) / 2 + 16px))",
        }}
      >
        <span
          style={{
            // Token e não um valor à mão: `[data-app="web"]` põe
            // `--fs-label` nos 14 px que 07 §3 fixa como mínimo do site
            // público. Escrever "12px" aqui furava esse piso.
            fontSize: "var(--fs-label)",
            fontWeight: "var(--fw-semibold)",
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

      {/* A altura mínima é o que a imagem ocupa quando passa para baixo do
          texto, num telemóvel; ao lado do texto estica até à altura dele. */}
      {/* `grid` para a imagem esticar: um `height: 100%` não resolve contra
          um `min-height`. */}
      <div style={{ minHeight: "clamp(18rem, 50vw, 38rem)", display: "grid" }}>
        <SiteImage src={SITE_IMAGES.hero} label={t("imageLabel")} rounded={false} priority />
      </div>
    </section>
  );
}
