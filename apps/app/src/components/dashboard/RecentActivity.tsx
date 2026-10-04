import { FileSignature, MessageSquare } from "lucide-react";
import { Card, StatusTag, type StatusTone } from "@upm/ui";

export type ActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  tag: string;
  tone: StatusTone;
};

export type RecentActivityProps = {
  messages: ActivityItem[];
  /** Nota do painel de mensagens: "2 por responder". */
  messagesMeta: string;
  contracts: ActivityItem[];
  contractsMeta: string;
};

/**
 * "Atividade recente" (D23) — 04 §8.3, o bloco por baixo de "Gráficos"
 * =========================================================================
 * Duas colunas: "Mensagens recentes" e "Contratos", como a referência
 * (`App Proprietario.dc.html`, `panels`).
 *
 * O segundo painel chamou-se "Documentos e contratos" até à Fase 6, e mostrava
 * só documentos — era metade do título a fingir (D29). Fecha por decisão do
 * cliente a 30 set 2026: passa a **Contratos**, e passa a mostrar contratos.
 * Os documentos do imóvel saem daqui — vivem no imóvel e na Cloud, na subpasta
 * "Documentos do imóvel" (07 §19.5), e o que um painel de atividade recente
 * tem para dizer é o que mudou: um contrato partilhado, por assinar, assinado.
 *
 * Os tons dos estados vêm da família genérica de ciclo de vida: 04 §5.6 não
 * define cores para estados de contrato, e inventar uma família partiria a
 * regra de "uma cor, um significado" que `StatusTag.test.ts` vigia.
 */
export function RecentActivity({
  messages,
  messagesMeta,
  contracts,
  contractsMeta,
}: RecentActivityProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 330px), 1fr))",
        gap: "var(--sp-7)",
      }}
    >
      <ActivityPanel
        icon={<MessageSquare size={16} aria-hidden="true" color="var(--accent)" />}
        title="Mensagens recentes"
        meta={messagesMeta}
        items={messages}
        empty="Ainda sem mensagens."
      />
      <ActivityPanel
        icon={<FileSignature size={16} aria-hidden="true" color="var(--accent)" />}
        title="Contratos"
        meta={contractsMeta}
        items={contracts}
        empty="Ainda sem contratos."
      />
    </div>
  );
}

function ActivityPanel({
  icon,
  title,
  meta,
  items,
  empty,
}: {
  icon: React.ReactNode;
  title: string;
  meta: string;
  items: ActivityItem[];
  empty: string;
}) {
  return (
    <Card style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--sp-4)",
          padding: "var(--sp-6) var(--sp-7)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {icon}
        <strong style={{ fontSize: "var(--fs-body-lg)" }}>{title}</strong>
        <span style={{ marginLeft: "auto", color: "var(--muted)", whiteSpace: "nowrap" }}>
          {meta}
        </span>
      </div>

      {items.length === 0 ? (
        <p style={{ margin: 0, padding: "var(--sp-7)", color: "var(--muted)" }}>{empty}</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {items.map((item) => (
            <li key={item.id} style={{ borderBottom: "1px solid var(--border)" }}>
              <a
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--sp-5)",
                  padding: "var(--sp-5) var(--sp-7)",
                  color: "var(--text)",
                  textDecoration: "none",
                  minWidth: 0,
                }}
              >
                <span style={{ display: "grid", gap: "var(--sp-1)", minWidth: 0, flex: 1 }}>
                  <strong
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.title}
                  </strong>
                  <span
                    style={{
                      color: "var(--muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.subtitle}
                  </span>
                </span>
                <StatusTag tone={item.tone}>{item.tag}</StatusTag>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
