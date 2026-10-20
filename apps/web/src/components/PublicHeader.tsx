"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Brand, LanguageMenu, ThemeToggle } from "@upm/ui";
import { LOCALES } from "@upm/config";

import { NAV_ANCHOR_IDS } from "../lib/site-content";

/**
 * Cabeçalho do site público (P1-03 · P1-05 · completado em P2-01)
 * =========================================================================
 * O `www` **não** usa o shell da app: 03 §1.1 pede navbar fixa ao topo,
 * âncoras com `scroll-margin-top` e um botão primário que muda com
 * `launch_mode`. O que partilha com a app são os tokens, as fontes, o
 * alternador de tema e o seletor de idioma.
 *
 * A Fase 1 entregou a barra mínima e deixou escrito que "a navbar completa é
 * da Fase 5". É esta — as secções, a faixa de pré-lançamento e o CTA por modo
 * entraram agora, com o Site público (D59).
 *
 * **As âncoras aparecem em todas as páginas do site** (12 out 2026). Até aqui
 * só a home as mostrava, com o argumento de que "um menu que promete Preços e
 * não vai a lado nenhum é pior do que não ter menu". O argumento estava certo e
 * a conclusão errada: o problema era o `href`, não o menu. Quem abre `/termos`
 * ou `/imoveis` fica sem **nenhuma** forma de voltar às secções do site — e uma
 * barra com marca e um botão só não é navegação.
 *
 * Daí `anchors`, que diz **para onde** a âncora aponta e não se existe:
 *
 * - `"same-page"` — na home, `#precos`: rola, sem recarregar nada.
 * - `"home"` — fora dela, `/#precos`: vai à home e cai na secção.
 * - `"none"` — quando não há sítio para onde mandar a pessoa.
 */
export function PublicHeader({
  locale,
  onLocaleChange,
  launchMode = "pre",
  anchors = "home",
}: {
  locale: string;
  onLocaleChange: (locale: string) => void | Promise<void>;
  launchMode?: "pre" | "post";
  anchors?: "none" | "same-page" | "home";
}) {
  const t = useTranslations();
  const ctaHref = launchMode === "pre" ? "/pre-inscricao" : "/criar-conta";
  const ctaLabel = launchMode === "pre" ? "Pré-inscrição" : "Criar conta";

  return (
    <>
      {/* A faixa só existe em pré-lançamento: em pós-lançamento o site deixa
          de ser uma promessa e passa a ser um produto aberto (P11-10). */}
      {launchMode === "pre" ? (
        <div
          style={{
            background: "var(--accent)",
            color: "var(--on-solid)",
            textAlign: "center",
            fontSize: "var(--fs-label)",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            padding: "8px 16px",
          }}
        >
          {t("site.preLaunchBanner")}
        </div>
      ) : null}

      <header className="upm-topbar">
        {/* `column-gap` só aqui, por cima do `gap: var(--sp-6)` que
            `.upm-topbar__inner` dá a toda a app: a barra do site público leva
            marca, seis âncoras, idioma, tema e CTA na mesma linha, e com o
            espaçamento da app os blocos ficavam encostados. Ajustado no canvas
            a 12 out 2026. */}
        <div className="upm-topbar__inner" style={{ columnGap: "48px" }}>
          <Link href="/" aria-label="UProperty Market">
            <Brand />
          </Link>

          {anchors !== "none" ? (
            <nav
              aria-label={t("site.nav.sections")}
              style={{
                display: "flex",
                gap: "var(--sp-5)",
                flexWrap: "wrap",
                justifyContent: "center",
                minWidth: 0,
              }}
            >
              {NAV_ANCHOR_IDS.map((anchorId) => (
                <a
                  key={anchorId}
                  href={anchors === "same-page" ? `#${anchorId}` : `/#${anchorId}`}
                  style={{ fontSize: "var(--fs-body)", color: "var(--text)", whiteSpace: "nowrap" }}
                >
                  {t(`site.nav.${anchorId}`)}
                </a>
              ))}
            </nav>
          ) : null}

          <div className="upm-topbar__actions">
            {/* Os mesmos dois controlos da topbar da app, e não uma versão
                própria: 04 §1.5 quer a barra de topo "igual para todos".
                Até 8 out 2026 isto desenhava os idiomas como dois `<Button>`
                lado a lado — padrão que não existe em lado nenhum da app e
                que deixa de caber ao terceiro idioma. */}
            <LanguageMenu
              locale={locale}
              locales={LOCALES.map((value) => ({ value, label: t(`locale.${value}`) }))}
              onLocaleChange={(next) => void onLocaleChange(next)}
              label={t("locale.title")}
            />
            <ThemeToggle
              variant="segmented"
              labels={{
                title: t("theme.title"),
                light: t("theme.light"),
                dark: t("theme.dark"),
                system: t("theme.system"),
              }}
            />
            {/* `md` e não `sm`: 04 §1.8 fixa 36 px como a altura padrão de um
                botão, e um CTA de barra de topo não é uma ação dentro de uma
                linha de lista. */}
            <Link href={ctaHref} className="upm-btn upm-btn--primary upm-btn--md">
              {ctaLabel}
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
