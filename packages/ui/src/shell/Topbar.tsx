"use client";

import { useState } from "react";
import { Bell, Languages, Menu, Search } from "lucide-react";

import { cx } from "../lib/cx";
import { Button } from "../components/Button";
import { Input } from "../components/Input";
import { useClickOutside } from "../lib/useDismissable";
import { ThemeToggle, type ThemeToggleLabels } from "../theme/ThemeToggle";

export type Notification = {
  id: string;
  text: string;
  when: string;
  read: boolean;
  href?: string;
};

export type LocaleOption = {
  value: string;
  label: string;
};

export type TopbarLabels = {
  search: string;
  openMenu: string;
  language: string;
  notifications: string;
  markAllRead: string;
  noNotifications: string;
  theme: ThemeToggleLabels;
};

export type TopbarProps = {
  labels: TopbarLabels;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  locale: string;
  locales: LocaleOption[];
  onLocaleChange: (locale: string) => void;
  notifications: Notification[];
  onMarkAllRead: () => void;
  onNotificationClick?: (notification: Notification) => void;
  /** Só visível abaixo de 768 px, onde a sidebar é drawer (02 §13). */
  onOpenSidebar?: () => void;
  className?: string;
};

/**
 * Topbar — 04 §5.5
 * =========================================================================
 * 64–68 px, sticky, **igual para todos os perfis**: pesquisa, seletor de
 * idioma, alternador de tema e sino de notificações com "marcar como lidas".
 *
 * Os dois dropdowns fecham por clique fora e por `Esc` (04 §5.7). Nenhum deles
 * é modal — são menus leves, não diálogos, logo não prendem o foco.
 */
export function Topbar({
  labels,
  searchValue,
  onSearchChange,
  locale,
  locales,
  onLocaleChange,
  notifications,
  onMarkAllRead,
  onNotificationClick,
  onOpenSidebar,
  className,
}: TopbarProps) {
  const [langOpen, setLangOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const langRef = useClickOutside<HTMLDivElement>(langOpen, () => setLangOpen(false));
  const notifRef = useClickOutside<HTMLDivElement>(notifOpen, () => setNotifOpen(false));

  const unread = notifications.filter((item) => !item.read).length;
  const currentLocale = locales.find((item) => item.value === locale);

  return (
    /*
      A barra pinta-se a toda a largura (fundo e traço inferior encostam às
      bordas), mas o que está dentro dela respeita o mesmo limite do conteúdo
      da página — senão a pesquisa deixa de alinhar com o primeiro cartão num
      ecrã largo (04 §1.5).
    */
    <header className={cx("upm-topbar", className)}>
      <div className="upm-topbar__inner">
        {onOpenSidebar ? (
          <Button
            variant="ghost"
            iconOnly
            className="upm-topbar__burger"
            aria-label={labels.openMenu}
            onClick={onOpenSidebar}
          >
            <Menu size={18} />
          </Button>
        ) : null}

        <Input
          className="upm-topbar__search"
          label={labels.search}
          labelHidden
          type="search"
          placeholder={labels.search}
          leadingIcon={<Search size={16} aria-hidden="true" />}
          value={searchValue}
          onChange={onSearchChange ? (event) => onSearchChange(event.target.value) : undefined}
        />

        <div className="upm-topbar__actions">
          <div className="upm-menu" ref={langRef}>
            <Button
              variant="secondary"
              iconOnly
              aria-haspopup="menu"
              aria-expanded={langOpen}
              aria-label={`${labels.language}: ${currentLocale?.label ?? locale}`}
              title={`${labels.language}: ${currentLocale?.label ?? locale}`}
              onClick={() => setLangOpen((value) => !value)}
            >
              <Languages size={17} />
            </Button>
            {langOpen ? (
              <div className="upm-menu__panel" role="menu" aria-label={labels.language}>
                {locales.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={option.value === locale}
                    className="upm-menu__item"
                    onClick={() => {
                      onLocaleChange(option.value);
                      setLangOpen(false);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <ThemeToggle variant="segmented" labels={labels.theme} />

          <div className="upm-menu" ref={notifRef}>
            <Button
              variant="secondary"
              iconOnly
              aria-haspopup="menu"
              aria-expanded={notifOpen}
              aria-label={unread > 0 ? `${labels.notifications} (${unread})` : labels.notifications}
              title={labels.notifications}
              onClick={() => setNotifOpen((value) => !value)}
            >
              <Bell size={17} />
            </Button>
            {notifOpen ? (
              <div className="upm-menu__panel" role="menu" aria-label={labels.notifications}>
                <div className="upm-menu__header">
                  {labels.notifications}
                  {unread > 0 ? (
                    <button
                      type="button"
                      className={cx("upm-btn", "upm-btn--ghost", "upm-btn--sm")}
                      onClick={onMarkAllRead}
                    >
                      {labels.markAllRead}
                    </button>
                  ) : null}
                </div>
                {notifications.length === 0 ? (
                  <span className="upm-menu__item">{labels.noNotifications}</span>
                ) : (
                  notifications.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      className={cx("upm-menu__item", !item.read && "upm-menu__item--unread")}
                      onClick={() => {
                        onNotificationClick?.(item);
                        setNotifOpen(false);
                      }}
                    >
                      {item.text}
                      <span className="upm-usercard__meta">{item.when}</span>
                    </button>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
