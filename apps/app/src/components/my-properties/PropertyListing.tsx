import type { Tables } from "@upm/db";
import { Card, StatusTag, Table, type StatusTone, type TableColumn } from "@upm/ui";

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

export const PROPERTY_STATUS_LABEL: Record<PropertyRow["status"], string> = {
  draft: "Rascunho",
  pending_review: "Em revisão",
  active: "Ativo",
  featured: "Destaque",
  rejected: "Rejeitado",
  archived: "Arquivado",
  rented: "Arrendado",
  sold: "Vendido",
};

export const PROPERTY_STATUS_OPTIONS = (
  Object.keys(PROPERTY_STATUS_LABEL) as PropertyRow["status"][]
).map((value) => ({ value, label: PROPERTY_STATUS_LABEL[value] }));

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
  const columns: TableColumn<PropertyListingRow>[] = [
    {
      id: "cover",
      header: "Foto",
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
    { id: "title", header: "Título", cell: (row) => row.title || "(sem título)" },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <StatusTag tone={PROPERTY_STATUS_TONE[row.status]}>
          {PROPERTY_STATUS_LABEL[row.status]}
        </StatusTag>
      ),
    },
    {
      id: "price",
      header: "Preço",
      numeric: true,
      cell: (row) => formatCents(row.price_cents ?? row.rent_cents),
    },
    { id: "views", header: "Visitas", numeric: true, cell: (row) => row.views_count },
    {
      id: "actions",
      header: "Ações",
      cell: (row) => (
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
          <a href={`/propriedades/${row.id}/estatisticas`}>Estatísticas</a>
          <a href={`/propriedades/${row.id}/editar`}>Editar</a>
          {row.status !== "archived" ? (
            <ArchivePropertyButton propertyId={row.id} title={row.title} onArchive={onArchive} />
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 className="upm-card__title">As minhas propriedades</h1>
        <div style={{ maxWidth: 220, width: "100%" }}>
          <PropertyStatusFilter value={statusValue} options={PROPERTY_STATUS_OPTIONS} />
        </div>
      </div>
      <Card>
        <Table
          caption="As minhas propriedades"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          empty="Ainda não tem imóveis. Crie o primeiro em «Nova propriedade»."
        />
      </Card>
    </div>
  );
}
