"use client";

import { useTranslations } from "next-intl";
import { Brand, Button, ThemeToggle } from "@upm/ui";
import { LOCALES } from "@upm/config";

/**
 * Cabeçalho do site público (P1-03 · P1-05)
 * =========================================================================
 * O `www` **não** usa o shell da app: 03 §1.1 pede navbar fixa ao topo, âncoras
 * com `scroll-margin-top` e um botão primário que muda com `launch_mode`. O que
 * partilha com a app são os tokens, as fontes, o alternador de tema e o seletor
 * de idioma — que é o que esta Fase 1 tem de entregar.
 *
 * A navbar completa (secções, faixa de pré-lançamento, CTA por `launch_mode`)
 * é da Fase 5.
 */
export function PublicHeader({
  locale,
  onLocaleChange,
}: {
  locale: string;
  onLocaleChange: (locale: string) => void | Promise<void>;
}) {
  const t = useTranslations();

  return (
    <header className="upm-topbar">
      <Brand />
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
      </div>
    </header>
  );
}
