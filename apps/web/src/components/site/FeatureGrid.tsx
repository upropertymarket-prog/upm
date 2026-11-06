import {
  BadgePercent,
  Banknote,
  BellRing,
  Building2,
  CalendarCheck,
  Cloud,
  Eye,
  FileSignature,
  Handshake,
  LayoutDashboard,
  MapPin,
  MessageSquare,
  Scale,
  ShieldCheck,
} from "lucide-react";

import type { FeatureCard, IconName } from "../../lib/site-content";

/**
 * Grelha de cartões com ícone (P2-01)
 * =========================================================================
 * Serve três secções do protótipo — "Em breve", "Para particulares" e "Para
 * empresas" — porque as três são a mesma coisa: ícone, título, corpo. Um
 * componente por secção seria três cópias a divergir à primeira alteração de
 * espaçamento.
 *
 * O mapa de ícones é explícito e fechado: um `IconName` que não exista aqui é
 * erro de compilação, não um cartão sem ícone em produção.
 */

const ICONS: Record<IconName, typeof Handshake> = {
  handshake: Handshake,
  banknote: Banknote,
  "calendar-check": CalendarCheck,
  cloud: Cloud,
  "message-square": MessageSquare,
  "map-pin": MapPin,
  "bell-ring": BellRing,
  "badge-percent": BadgePercent,
  "building-2": Building2,
  "shield-check": ShieldCheck,
  "layout-dashboard": LayoutDashboard,
  "file-signature": FileSignature,
  scale: Scale,
  eye: Eye,
};

export function FeatureGrid({
  cards,
  minColumn = "16rem",
}: {
  cards: readonly FeatureCard[];
  minColumn?: string;
}) {
  return (
    <ul
      style={{
        listStyle: "none",
        margin: 0,
        padding: 0,
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(min(${minColumn}, 100%), 1fr))`,
        gap: "var(--sp-4)",
      }}
    >
      {cards.map((card) => {
        const Icon = ICONS[card.icon];
        return (
          <li
            key={card.title}
            style={{
              display: "grid",
              gap: "var(--sp-3)",
              alignContent: "start",
              padding: "var(--sp-5)",
              borderRadius: "var(--r-lg)",
              border: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: "grid",
                placeItems: "center",
                width: "40px",
                height: "40px",
                borderRadius: "var(--r-md)",
                background: "var(--accent-soft)",
                color: "var(--accent)",
              }}
            >
              <Icon size={19} />
            </span>
            <strong style={{ fontSize: "15px", color: "var(--text)" }}>{card.title}</strong>
            <p style={{ margin: 0, fontSize: "14px", lineHeight: 1.55, color: "var(--muted)" }}>
              {card.body}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
