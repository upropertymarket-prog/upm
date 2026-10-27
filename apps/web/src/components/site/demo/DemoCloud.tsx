"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  ArrowUpFromLine,
  Cloud as CloudIcon,
  Download,
  FolderPlus,
  Share2,
  Trash2,
} from "lucide-react";
import { Badge, Button, Card, StatusTag, Table, type TableColumn } from "@upm/ui";
import {
  DEMO_BUYER_FILES,
  DEMO_BUYER_FOLDERS,
  DEMO_BUYER_STORAGE,
  DEMO_OWNER_FILES,
  DEMO_OWNER_FOLDERS,
  DEMO_OWNER_STORAGE,
  type DemoFile,
} from "@upm/ui/demo-data";

import { useDemoFormat, type DemoRole } from "./format";

/**
 * Cloud da demonstração — 07 §19.5 e §19.9
 * =========================================================================
 * As duas colunas de `CloudScreen`: as pastas e a quota à esquerda, a tabela de
 * ficheiros à direita. Navegar entre pastas funciona — é o que este ecrã é —, e
 * carregar, partilhar e eliminar desenham-se: não há ficheiros para onde
 * escrever, nem deve haver.
 *
 * A etiqueta de origem ("Documento de imóvel", "Fatura") vem de
 * `cloud.source.*`, as mesmas chaves do produto: é o que explica porque é que
 * um ficheiro apareceu na Cloud sem ninguém o ter carregado à mão (07 §19.5).
 */
export function DemoCloud({ role }: { role: DemoRole }) {
  const t = useTranslations("cloud");
  const format = useDemoFormat();
  const owner = role === "owner";

  const folders = owner ? DEMO_OWNER_FOLDERS : DEMO_BUYER_FOLDERS;
  const files = owner ? DEMO_OWNER_FILES : DEMO_BUYER_FILES;
  const storage = owner ? DEMO_OWNER_STORAGE : DEMO_BUYER_STORAGE;

  const [folderId, setFolderId] = useState<string | null>(null);
  const visible = folderId ? files.filter((file) => file.folderId === folderId) : files;
  const usedRatio = storage.usedBytes / storage.limitBytes;

  const columns: TableColumn<DemoFile>[] = [
    {
      id: "file",
      header: t("columns.file"),
      cell: (file) => (
        <div style={{ display: "grid", gap: "var(--sp-1)", minWidth: 0 }}>
          <strong style={{ fontWeight: "var(--fw-medium)" }}>{file.name}</strong>
          <span style={{ color: "var(--muted)", fontSize: "var(--fs-label)" }}>
            {format.bytes(file.bytes)}
            {file.sourceKey ? ` · ${t(`source.${file.sourceKey}`)}` : ""}
          </span>
        </div>
      ),
    },
    {
      id: "share",
      header: t("columns.share"),
      width: "150px",
      cell: (file) =>
        file.sharedWith ? (
          <StatusTag tone="primary">{file.sharedWith}</StatusTag>
        ) : (
          <span style={{ color: "var(--muted)" }}>—</span>
        ),
    },
    {
      id: "added",
      header: t("columns.added"),
      width: "130px",
      cell: (file) => <span style={{ color: "var(--muted)" }}>{format.agoDays(file.daysAgo)}</span>,
    },
    {
      id: "actions",
      header: t("columns.actions"),
      width: "160px",
      cell: (file) => (
        <div style={{ display: "flex", gap: "var(--sp-3)" }}>
          <Button variant="secondary" iconOnly aria-label={t("downloadFile", { name: file.name })}>
            <Download size={15} />
          </Button>
          <Button variant="secondary" iconOnly aria-label={t("shareFile", { name: file.name })}>
            <Share2 size={15} />
          </Button>
          <Button variant="ghost" iconOnly aria-label={t("deleteFile", { name: file.name })}>
            <Trash2 size={15} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      <div style={{ display: "flex", gap: "var(--sp-4)", flexWrap: "wrap" }}>
        <Button variant="secondary" leadingIcon={<FolderPlus size={15} />}>
          {t("newFolder")}
        </Button>
        <Button leadingIcon={<ArrowUpFromLine size={15} />}>{t("upload")}</Button>
      </div>

      <div className="upm-demo-panes" style={{ ["--demo-panes-align" as string]: "start" }}>
        <Card padded style={{ display: "grid", gap: "var(--sp-6)" }}>
          <div style={{ display: "grid", gap: "var(--sp-3)", alignContent: "start" }}>
            <FolderRow
              label={t("navAll")}
              icon={<CloudIcon size={15} aria-hidden="true" />}
              count={files.length}
              active={folderId === null}
              onClick={() => setFolderId(null)}
            />
            {folders.map((folder) => (
              <FolderRow
                key={folder.id}
                label={folder.name}
                count={files.filter((file) => file.folderId === folder.id).length}
                active={folderId === folder.id}
                onClick={() => setFolderId(folder.id)}
              />
            ))}
          </div>

          <div
            style={{
              display: "grid",
              gap: "var(--sp-4)",
              borderTop: "1px solid var(--border)",
              paddingTop: "var(--sp-5)",
            }}
          >
            <strong>{t("storage")}</strong>
            <div
              aria-hidden="true"
              style={{
                height: 8,
                borderRadius: "var(--r-pill)",
                background: "var(--surface3)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${Math.round(usedRatio * 100)}%`,
                  height: "100%",
                  background: usedRatio > 0.9 ? "var(--warn)" : "var(--accent)",
                }}
              />
            </div>
            <span style={{ color: "var(--muted)", fontSize: "var(--fs-label)" }}>
              {t("storageUsed", {
                used: format.bytes(storage.usedBytes),
                limit: format.bytes(storage.limitBytes),
              })}
            </span>
          </div>
        </Card>

        <Card>
          <Table
            caption={t("tableCaption")}
            columns={columns}
            rows={visible}
            rowKey={(file) => file.id}
            empty={t("tableEmpty")}
          />
        </Card>
      </div>
    </div>
  );
}

function FolderRow({
  label,
  icon,
  count,
  active,
  onClick,
}: {
  label: string;
  icon?: React.ReactNode;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--sp-3)",
        width: "100%",
        padding: "var(--sp-3) var(--sp-4)",
        borderRadius: "var(--r-lg)",
        border: "none",
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--text)",
        font: "inherit",
        fontWeight: "var(--fw-semibold)",
        textAlign: "left",
        cursor: "pointer",
        minWidth: 0,
      }}
    >
      {icon}
      <span
        style={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
      {count > 0 ? <Badge variant="muted">{count}</Badge> : null}
    </button>
  );
}
