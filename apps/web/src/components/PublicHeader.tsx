"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Brand, Button, ThemeToggle } from "@upm/ui";
import { LOCALES } from "@upm/config";

import { NAV_ANCHORS, PRE_LAUNCH_BANNER } from "../lib/site-content";

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
 * As âncoras só aparecem quando há secções para onde saltar, ou seja na home.
 * Numa página legal, um menu que promete "Preços" e não vai a lado nenhum é
 * pior do que não ter menu.
 */
export function PublicHeader({
  locale,
  onLocaleChange,
  launchMode = "pre",
  showAnchors = false,
}: {
  locale: string;
  onLocaleChange: (locale: string) => void | Promise<void>;
  launchMode?: "pre" | "post";
  showAnchors?: boolean;
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
            fontSize: "11.5px",
            fontWeight: 700,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            padding: "8px 16px",
          }}
        >
          {PRE_LAUNCH_BANNER}
        </div>
      ) : null}

      <header className="upm-topbar">
        <div className="upm-topbar__inner">
          <Link href="/" aria-label="UProperty Market">
            <Brand />
          </Link>

          {showAnchors ? (
            <nav
              aria-label="Secções"
              style={{
                display: "flex",
                gap: "var(--sp-5)",
                flexWrap: "wrap",
                justifyContent: "center",
                minWidth: 0,
              }}
            >
              {NAV_ANCHORS.map((anchor) => (
                <a
                  key={anchor.id}
                  href={`#${anchor.id}`}
                  style={{ fontSize: "13px", color: "var(--text)", whiteSpace: "nowrap" }}
                >
                  {anchor.label}
                </a>
              ))}
            </nav>
          ) : null}

          <div className="upm-topbar__actions">
            {LOCALES.map((value) => (
              <Button
                key={value}
                variant={value === locale ? "primary" : "ghost"}
                size="sm"
                aria-pressed={value === locale}
                onClick={() => void onLocaleChange(value)}
              >
                {t(`locale.${value}`)}
              </Button>
            ))}
            <ThemeToggle
              labels={{
                title: t("theme.title"),
                light: t("theme.light"),
                dark: t("theme.dark"),
                system: t("theme.system"),
              }}
            />
            <Link href={ctaHref} className="upm-btn upm-btn--primary upm-btn--sm">
              {ctaLabel}
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
