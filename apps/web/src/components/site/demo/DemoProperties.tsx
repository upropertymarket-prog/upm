"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Image as ImageIcon } from "lucide-react";
import { Button, Card, Select, StatusTag, Table, type StatusTone, type TableColumn } from "@upm/ui";
import { DEMO_OWNER_PROPERTIES, type DemoProperty } from "@upm/ui/demo-data";

import { useDemoFormat } from "./format";

/**
 * "As minhas propriedades" da demonstração — 04 §8.3
 * =========================================================================
 * O mesmo desenho de `PropertyListing`: filtro de estado na barra do título e
 * uma tabela por baixo, com capa, título, estado, preço, visitas e ações. Os
 * tons dos estados são os do produto (`PROPERTY_STATUS_TONE`), porque 04 §5.6
 * exige uma cor por significado em todo o produto — e a demonstração é a
 * primeira vez que um visitante vê essas cores.
 *
 * O filtro filtra; as três ações desenham-se. Arquivar um imóvel inventado não
 * tem para onde escrever.
 */

const STATUS_TONE: Record<DemoProperty["status"], StatusTone> = {
  draft: "draft",
  pending_review: "pending",
  active: "active",
  featured: "active",
};

const STATUS_VALUES: DemoProperty["status"][] = ["draft", "pending_review", "active", "featured"];

export function DemoProperties() {
  const t = useTranslations("myProperties");
  const ts = useTranslations("property.status");
  const format = useDemoFormat();
  const [status, setStatus] = useState("");

  const rows = status
    ? DEMO_OWNER_PROPERTIES.filter((property) => property.status === status)
    : DEMO_OWNER_PROPERTIES;

  const columns: TableColumn<DemoProperty>[] = [
    {
      id: "cover",
      header: t("photo"),
      width: "72px",
      cell: () => (
        <div
          aria-hidden="true"
          style={{
            width: 56,
            height: 40,
            borderRadius: 8,
            background: "var(--surface2)",
            display: "grid",
            placeItems: "center",
            color: "var(--border2)",
          }}
        >
          <ImageIcon size={15} />
        </div>
      ),
    },
    {
      id: "title",
      header: t("listingTitle"),
      cell: (row) => <span style={{ fontWeight: "var(--fw-medium)" }}>{row.title}</span>,
    },
    {
      id: "status",
      header: t("status"),
      width: "138px",
      cell: (row) => <StatusTag tone={STATUS_TONE[row.status]}>{ts(row.status)}</StatusTag>,
    },
    {
      id: "price",
      header: t("price"),
      numeric: true,
      align: "left",
      width: "140px",
      cell: (row) => (row.cents === null ? "—" : format.euro(row.cents)),
    },
    {
      id: "views",
      header: t("views"),
      numeric: true,
      align: "left",
      width: "100px",
      cell: (row) => format.number(row.views),
    },
    {
      id: "actions",
      header: t("actions"),
      align: "left",
      width: "240px",
      cell: (row) => (
        <div style={{ display: "flex", gap: "var(--sp-4)", alignItems: "center" }}>
          <Button variant="secondary" size="sm">
            {t("stats")}
          </Button>
          <Button variant="secondary" size="sm">
            {t("edit")}
          </Button>
          <Button variant="secondary" size="sm" disabled={row.status === "draft"}>
            {t("archive.action")}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ minWidth: 220 }}>
          <Select
            label={t("status")}
            labelHidden
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            placeholder={t("allStatuses")}
            options={STATUS_VALUES.map((value) => ({ value, label: ts(value) }))}
          />
        </div>
      </div>

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
