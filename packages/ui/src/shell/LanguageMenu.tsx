"use client";

import { useState } from "react";
import { Languages } from "lucide-react";

import { cx } from "../lib/cx";
import { Button } from "../components/Button";
import { useClickOutside } from "../lib/useDismissable";

export type LocaleOption = {
  value: string;
  label: string;
};

/**
 * Seletor de idioma — 04 §1.5
 * =========================================================================
 * Saiu de dentro do `Topbar` a 8 out 2026, sem mudar de desenho: botão só de
 * ícone (`Languages`, alvo de 40 × 40 px por `.upm-btn--icon`) e um menu leve
 * com uma opção por idioma.
 *
 * O motivo da extração é o site público. 04 §1.5 diz que a barra de topo é
 * "igual para todos", e o `PublicHeader` tinha-se desviado: desenhava os
 * idiomas como dois botões lado a lado, um deles primário. A dois idiomas isso
 * ainda passa por um segmentado; ao terceiro deixa de caber, e já não era o
 * padrão da app em nenhum dos casos. Um componente partilhado é a forma de
 * isto não voltar a divergir — e não um comentário a pedir que não divirja.
 *
 * Não é modal: é um menu, não um diálogo, logo fecha por clique fora e por
 * `Esc` (04 §1.7) mas não prende o foco.
 */
export function LanguageMenu({
  locale,
  locales,
  onLocaleChange,
  /** Nome do controlo, para o `aria-label` e o `title`. */
  label,
  className,
}: {
  locale: string;
  locales: LocaleOption[];
  onLocaleChange: (locale: string) => void;
  label: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));

  const current = locales.find((item) => item.value === locale);
  const described = `${label}: ${current?.label ?? locale}`;

  return (
    <div className={cx("upm-menu", className)} ref={ref}>
      <Button
        variant="secondary"
        iconOnly
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={described}
        title={described}
        onClick={() => setOpen((value) => !value)}
      >
        <Languages size={17} />
      </Button>
      {open ? (
        <div className="upm-menu__panel upm-menu__panel--compact" role="menu" aria-label={label}>
          {locales.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === locale}
              className="upm-menu__item"
              onClick={() => {
                onLocaleChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
