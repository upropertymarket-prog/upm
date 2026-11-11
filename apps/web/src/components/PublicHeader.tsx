"use client";

import { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Brand, LanguageMenu, ThemeToggle } from "@upm/ui";
import { LOCALES } from "@upm/config";
import { Menu, X } from "lucide-react";

import { NAV_ANCHOR_IDS } from "../lib/site-content";
import { useCanvasSafeRouter } from "@/lib/useCanvasSafeRouter";

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
 * ou `/propriedades` fica sem **nenhuma** forma de voltar às secções do site — e uma
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
  /**
   * **Opcional desde 20 out 2026, e normalmente não se passa.**
   *
   * O idioma passou a estar no caminho (`/en`), logo trocá-lo é *navegar* para
   * a mesma página na outra língua — e quem sabe qual é a página atual é este
   * componente, pelo `usePathname` do `next-intl`. Antes era uma Server Action
   * a escrever o cookie, enfiada por prop em oito sítios; hoje nenhum deles
   * precisa de saber que o site é bilingue.
   *
   * O cookie continua a ser escrito, e não por nós: o middleware do `next-intl`
   * sincroniza-o a cada navegação, com o nome `upm-locale` que o
   * `i18n/routing.ts` lhe dá. É isso que leva a escolha do site para a app
   * autenticada, que continua a ler o cookie.
   *
   * A prop fica como escape, e tem um utilizador concreto: as storyboards do
   * canvas passam um no-op. Lá, navegar levaria o iframe do canvas para uma
   * rota que o devserver não serve e a storyboard ficava presa num 404 — o
   * mesmo motivo que já está escrito no `ContactActions`.
   */
  onLocaleChange?: (locale: string) => void | Promise<void>;
  launchMode?: "pre" | "post";
  anchors?: "none" | "same-page" | "home";
}) {
  const t = useTranslations();
  // Ver `useCanvasSafeRouter`: no canvas não há router, e o do next-intl atira.
  const router = useCanvasSafeRouter();
  const pathname = usePathname();
  const params = useParams();
  const ctaHref = launchMode === "pre" ? "/pre-inscricao" : "/criar-conta";
  const ctaLabel = t(`site.headerCta.${launchMode}`);
  // O menu do telemóvel (7 nov 2026): as âncoras saem da barra abaixo de
  // 1024 px de página (`shell.css`) e passam para esta lista.
  const [menuAberto, setMenuAberto] = useState(false);
  const temMenu = anchors !== "none";
  const temaLabels = {
    title: t("theme.title"),
    light: t("theme.light"),
    dark: t("theme.dark"),
    system: t("theme.system"),
  };

  const trocarIdioma = (next: string) => {
    if (onLocaleChange) {
      void onLocaleChange(next);
      return;
    }

    /**
     * `{ pathname, params }` e não só `pathname`: numa rota dinâmica o
     * `usePathname` do `next-intl` devolve o **molde**
     * (`/propriedades/[slug]`), não o caminho concreto. Sem os `params`, trocar
     * de idioma na ficha de uma propriedade levava a `/en/properties/[slug]`
     * — com os cinco caracteres literais no URL.
     *
     * O `ts-expect-error` é o padrão que o próprio `next-intl` documenta para o
     * caso genérico: o TypeScript não consegue provar que estes `params`
     * pertencem a este `pathname`, porque nenhum dos dois é conhecido em tempo
     * de compilação neste componente — ele serve todas as páginas do site. Com
     * um `pathname` fixo a verificação funcionaria, e é por isso que o erro se
     * silencia aqui e em nenhum outro `Link`.
     *
     * `replace` e não `push`: trocar de idioma não é um passo no histórico, é a
     * mesma página noutra língua.
     */
    router?.replace(
      // @ts-expect-error -- ver acima: `pathname` e `params` são genéricos aqui.
      { pathname, params },
      { locale: next as (typeof LOCALES)[number] },
    );
  };

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
            // Excepção intencional ao piso de 14 px do site (07 §3), pedida
            // pelo cliente a 8 nov 2026. Registada em `tokens.css`.
            fontSize: "12px",
            fontWeight: "var(--fw-semibold)",
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
              className="upm-topbar__site-nav"
              aria-label={t("site.nav.sections")}
              style={{
                display: "flex",
                gap: "var(--sp-5)",
                // Nunca em duas linhas: quando não cabem, saem para o menu (☰).
                flexWrap: "nowrap",
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
            {/* Abaixo de 640 px sai para o menu (☰), junto do tema (11 nov
                2026): com marca, idioma, CTA e ☰ na mesma linha a barra ficava
                apertada e o CTA perdia o destaque. */}
            <span className="upm-topbar__site-lang" style={{ display: "contents" }}>
              <LanguageMenu
                locale={locale}
                locales={LOCALES.map((value) => ({ value, label: t(`locale.${value}`) }))}
                onLocaleChange={trocarIdioma}
                label={t("locale.title")}
              />
            </span>
            {/* Em ecrã estreito sai (`shell.css`, "Barra do site público"): o
                tema segue o do sistema, e o CTA não pode cair da barra. */}
            <span className="upm-topbar__site-theme" style={{ display: "contents" }}>
              <ThemeToggle variant="segmented" labels={temaLabels} />
            </span>
            {/* `md` e não `sm`: 04 §1.8 fixa 36 px como a altura padrão de um
                botão, e um CTA de barra de topo não é uma ação dentro de uma
                linha de lista. */}
            <Link href={ctaHref} className="upm-btn upm-btn--primary upm-btn--md">
              {ctaLabel}
            </Link>
            {temMenu ? (
              <button
                type="button"
                className="upm-topbar__site-menu"
                aria-expanded={menuAberto}
                aria-controls="upm-site-menu"
                aria-label={menuAberto ? t("site.nav.closeMenu") : t("site.nav.openMenu")}
                onClick={() => setMenuAberto((aberto) => !aberto)}
              >
                {menuAberto ? (
                  <X size={20} aria-hidden="true" />
                ) : (
                  <Menu size={20} aria-hidden="true" />
                )}
              </button>
            ) : null}
          </div>
        </div>

        {temMenu && menuAberto ? (
          <div id="upm-site-menu" className="upm-topbar__site-panel">
            <nav aria-label={t("site.nav.sections")}>
              <ul>
                {NAV_ANCHOR_IDS.map((anchorId) => (
                  <li key={anchorId}>
                    {/* Fecha ao escolher: a âncora leva à secção, e o menu
                        aberto ficaria por cima dela. */}
                    <a
                      href={anchors === "same-page" ? `#${anchorId}` : `/#${anchorId}`}
                      onClick={() => setMenuAberto(false)}
                    >
                      {t(`site.nav.${anchorId}`)}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
            {/* Idioma e tema saem da barra abaixo de 640 px; aqui continuam à
                mão, lado a lado e com o mesmo controlo. O idioma é segmentado e
                não o `LanguageMenu`: um menu dentro do menu pedia dois toques. */}
            <div className="upm-topbar__site-panel-prefs">
              <div className="upm-topbar__site-panel-group">
                <span className="upm-topbar__site-panel-label">{t("locale.title")}</span>
                <div className="upm-segmented" role="radiogroup" aria-label={t("locale.title")}>
                  {LOCALES.map((value) => (
                    <button
                      key={value}
                      type="button"
                      role="radio"
                      aria-checked={locale === value}
                      className="upm-segmented__option"
                      onClick={() => {
                        setMenuAberto(false);
                        if (value !== locale) trocarIdioma(value);
                      }}
                    >
                      {t(`locale.${value}`)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="upm-topbar__site-panel-group">
                <span className="upm-topbar__site-panel-label">{temaLabels.title}</span>
                <ThemeToggle variant="segmented" labels={temaLabels} />
              </div>
            </div>
          </div>
        ) : null}
      </header>
    </>
  );
}
