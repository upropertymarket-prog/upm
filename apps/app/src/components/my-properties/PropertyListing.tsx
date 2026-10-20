import { useTranslations } from "next-intl";
import type { Tables } from "@upm/db";
import { Card, PageHeader, StatusTag, Table, type StatusTone, type TableColumn } from "@upm/ui";

import { ArchivePropertyButton, type ArchivePropertyAction } from "./ArchivePropertyButton";
import { PropertyStatusFilter } from "./PropertyStatusFilter";
import { formatCents } from "../../lib/money";

export type PropertyRow = Tables<"properties">;
export type PropertyListingRow = PropertyRow & { coverUrl: string | null };

export const PROPERTY_STATUS_TONE: Record<PropertyRow["status"], StatusTone> = {
  draft: "draft",
  pending_review: "pending",
  active: "active",
  featured: "active",
  rejected: "rejected",
  archived: "archived",
  rented: "archived",
  sold: "archived",
};

/**
 * Só os valores, pela ordem em que o filtro os mostra. As etiquetas saíram
 * daqui a 20 out 2026 (D72): uma constante de módulo é avaliada uma vez, no
 * arranque, e ficava presa ao idioma em que foi escrita. Hoje nascem dentro de
 * quem as desenha, a partir de `property.status`.
 */
export const PROPERTY_STATUS_VALUES = [
  "draft",
  "pending_review",
  "active",
  "featured",
  "rejected",
  "archived",
  "rented",
  "sold",
] as const satisfies readonly PropertyRow["status"][];

export type PropertyListingProps = {
  rows: PropertyListingRow[];
  statusValue: string;
  onArchive: ArchivePropertyAction;
};

/**
 * "As minhas propriedades" (P4-03) — Card + Table de imóveis do dono, com
 * filtro de estado e ação de arquivar. Extraído de `propriedades/page.tsx`
 * para ser reutilizável fora do Server Component (ex. canvas de demonstração
 * — ver `tempo/designs/canvases/proprietario`), com `rows` já resolvidas
 * (signed URLs incluídas) em vez de acesso direto ao Supabase.
 */
export function PropertyListing({ rows, statusValue, onArchive }: PropertyListingProps) {
  const t = useTranslations("myProperties");
  const ts = useTranslations("property.status");

  const columns: TableColumn<PropertyListingRow>[] = [
    {
      id: "cover",
      header: t("photo"),
      width: "72px",
      cell: (row) =>
        row.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed URL, expira; não vale o Image loader.
          <img
            src={row.coverUrl}
            alt=""
            width={56}
            height={40}
            style={{ objectFit: "cover", borderRadius: 8, width: 56, height: 40 }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              width: 56,
              height: 46,
              borderRadius: 8,
              background: "var(--surface-muted, #eee)",
            }}
          />
        ),
    },
    // Larguras medidas no canvas. Somam a largura útil da tabela, por isso a
    // folga fica repartida em vez de abrir um buraco numa coluna só.
    {
      id: "title",
      header: t("listingTitle"),
      width: "328px",
      cell: (row) => (
        <span style={{ fontWeight: "var(--fw-medium)" }}>{row.title || t("untitled")}</span>
      ),
    },
    {
      id: "status",
      header: t("status"),
      width: "138px",
      cell: (row) => (
        <StatusTag tone={PROPERTY_STATUS_TONE[row.status]}>{ts(row.status)}</StatusTag>
      ),
    },
    {
      id: "price",
      header: t("price"),
      numeric: true,
      align: "left",
      width: "164px",
      cell: (row) => formatCents(row.price_cents ?? row.rent_cents),
    },
    {
      id: "views",
      header: t("views"),
      numeric: true,
      align: "left",
      width: "138px",
      cell: (row) => row.views_count,
    },
    {
      id: "actions",
      header: t("actions"),
      align: "left",
      width: "290px",
      cell: (row) => (
        <div
          style={{
            display: "flex",
            gap: "var(--sp-4)",
            alignItems: "center",
            justifyContent: "flex-start",
          }}
        >
          <a
            href={`/propriedades/${row.id}/estatisticas`}
            className="upm-btn upm-btn--secondary upm-btn--sm"
            style={{ textDecoration: "none" }}
          >
            {t("stats")}
          </a>
          <a
            href={`/propriedades/${row.id}/editar`}
            className="upm-btn upm-btn--secondary upm-btn--sm"
            style={{ textDecoration: "none" }}
          >
            {t("edit")}
          </a>
          <ArchivePropertyButton
            propertyId={row.id}
            title={row.title}
            onArchive={onArchive}
            disabled={row.status === "archived"}
          />
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* O filtro de estado entra pelo `actions` do `PageHeader` — é a ação
          contextual desta página (04 §5.5), e assim o título fica igual ao das
          restantes em vez de ser um título de cartão. */}
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle", { count: rows.length })}
        actions={
          <div style={{ minWidth: 220 }}>
            <PropertyStatusFilter
              value={statusValue}
              options={PROPERTY_STATUS_VALUES.map((value) => ({ value, label: ts(value) }))}
            />
          </div>
        }
      />
      <Card>
        <Table
          caption={t("caption")}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          empty={t("empty")}
        />
      </Card>
    </div>
  );
}
