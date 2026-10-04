import { Building2, Map, PlusCircle, Store } from "lucide-react";

/**
 * "Acesso rápido" (P4-06) — os quatro atalhos do Painel, 04 §8.3.
 *
 * O desenho aponta dois destes atalhos para Agenda de visitas e Mensagens, que
 * são Fase 5. Um atalho para uma rota que ainda não existe é um beco, por isso
 * os quatro lugares ficam pelas rotas de Fase 4 até P5-01/P5-02 aterrarem.
 *
 * `<a>` e não `next/link`: com `typedRoutes` ligado, um `Link` para uma rota
 * que ainda não existe falha o typecheck — a mesma razão do `AppChrome`.
 */
const SHORTCUTS = [
  {
    href: "/market",
    icon: Store,
    title: "Market",
    body: "Veja todas as propriedades publicadas na plataforma.",
  },
  {
    href: "/propriedades",
    icon: Building2,
    title: "As minhas propriedades",
    body: "Gira o seu portfólio, anúncios e rascunhos.",
  },
  {
    href: "/propriedades/nova",
    icon: PlusCircle,
    title: "Publicar novo imóvel",
    body: "Preencha o anúncio por passos — pode guardar como rascunho.",
  },
  {
    href: "/mapa",
    icon: Map,
    title: "Mapa",
    body: "Veja o que está à venda e para arrendar na sua zona.",
  },
] as const;

export function QuickAccess() {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <h2
        style={{
          fontSize: "var(--fs-subtitle)",
          fontWeight: "var(--fw-bold)",
          color: "var(--text)",
          margin: 0,
        }}
      >
        Acesso rápido
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 220px), 1fr))",
          gap: 14,
        }}
      >
        {SHORTCUTS.map((shortcut) => {
          const Icon = shortcut.icon;
          return (
            <a
              key={shortcut.href}
              href={shortcut.href}
              className="upm-card upm-card--pad upm-card--interactive"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 11,
                textDecoration: "none",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "var(--r-lg)",
                    background: "var(--accent-soft)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flex: "none",
                  }}
                >
                  <Icon size={17} color="var(--accent)" aria-hidden="true" />
                </span>
                <strong style={{ fontSize: "var(--fs-body)", color: "var(--text)" }}>
                  {shortcut.title}
                </strong>
              </span>
              <span
                style={{
                  fontSize: "var(--fs-label)",
                  color: "var(--muted)",
                  lineHeight: "var(--lh-normal)",
                }}
              >
                {shortcut.body}
              </span>
            </a>
          );
        })}
      </div>
    </section>
  );
}
