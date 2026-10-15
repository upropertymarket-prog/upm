"use client";

import { useRef, useState, useTransition } from "react";
import {
  ArrowUpFromLine,
  Download,
  FileText,
  FolderPlus,
  Image as ImageIcon,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import {
  Button,
  EmptyState,
  PageHeader,
  StatusTag,
  Table,
  useToast,
  type TableColumn,
} from "@upm/ui";
import { formatBytes } from "@upm/db/cloud";

import type { StaffFile, StaffFolder } from "../lib/staff-cloud";
import type { StaffCloudResult } from "../app/actions/staff-cloud";

/**
 * A Cloud interna — o ecrã (P10-10 · 07 §24.6 · 05 §1.9)
 * =========================================================================
 * Um ecrã, duas rotas: `/suporte/cloud` e `/marketing/cloud` montam este mesmo
 * componente sobre a mesma gaveta (`scope = 'staff'`). A figura é a que 07
 * §24.5 fixou para o SEO — duas portas, um editor — e aqui vale mais ainda,
 * porque o que divergiria eram ficheiros.
 *
 * ## Porque é que não é o `CloudScreen` do cliente
 *
 * Seria o melhor sítio para o reaproveitar, e não foi possível hoje por uma
 * razão concreta: `CloudScreen` tem ~208 strings em português escritas no
 * ficheiro e não usa `next-intl`. O painel interno tem seletor de idioma, e
 * todos os componentes de `@upm/ui` recebem `labels` por props, sem exceção —
 * mover aquele ecrã como está punha um ecrã monolingue dentro de um painel
 * bilingue, e convertê-lo era traduzir a Cloud do cliente para inglês no meio
 * desta tarefa. A convergência está registada como dívida, com gatilho.
 *
 * ## O que este ecrã deliberadamente não tem
 *
 * **Partilhas.** Na Cloud do cliente partilhar é dar acesso a quem não o tinha;
 * aqui toda a equipa já o tem — `scope = 'staff'` **é** a partilha. Um botão de
 * partilhar só podia significar "para fora", que é outra funcionalidade.
 *
 * **Quota.** A Cloud da equipa não se cobra a ninguém, e
 * `cloud_register_staff_file` não consulta plano nenhum. Mostrar uma barra de
 * consumo aqui era desenhar um limite que não existe.
 *
 * **Subpastas.** Um nível só. Uma gaveta de equipa com três pastas encontra-se;
 * com uma árvore, não — e a árvore pede mover, que pede arrastar, que é outro
 * ecrã. Quando houver razão, há `parent_id` na tabela desde a Fase 6.
 */

export type StaffCloudProps = {
  folders: StaffFolder[];
  files: StaffFile[];
  locale: string;
  onUpload: (formData: FormData) => Promise<StaffCloudResult>;
  onCreateFolder: (name: string) => Promise<StaffCloudResult>;
  onDelete: (id: string) => Promise<StaffCloudResult>;
  onRestore: (id: string) => Promise<StaffCloudResult>;
  onDownloadUrl: (id: string) => Promise<StaffCloudResult>;
};

/** `null` = todos os ficheiros vivos; `"bin"` = a reciclagem. */
type View = string | null | "bin";

export function StaffCloud(props: StaffCloudProps) {
  const t = useTranslations("internalCloud");
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [view, setView] = useState<View>(null);
  const picker = useRef<HTMLInputElement>(null);

  const dateFormat = new Intl.DateTimeFormat(props.locale === "en" ? "en-IE" : "pt-PT", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const live = props.files.filter((file) => file.deletedAt === null);
  const binned = props.files.filter((file) => file.deletedAt !== null);

  const shown =
    view === "bin" ? binned : view === null ? live : live.filter((f) => f.folderId === view);

  function run(action: () => Promise<StaffCloudResult>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast(result.error, "error");
        return;
      }
      if (result.notice) toast(result.notice, "success");
    });
  }

  function upload(file: File) {
    const form = new FormData();
    form.set("file", file);
    // Carrega para a pasta aberta. Na raiz e na reciclagem vai para a raiz —
    // carregar "para a reciclagem" não quer dizer nada.
    if (view && view !== "bin") form.set("folderId", view);
    run(() => props.onUpload(form));
  }

  function download(id: string) {
    startTransition(async () => {
      const result = await props.onDownloadUrl(id);
      if (result.error || !result.url) {
        toast(result.error ?? t("downloadFailed"), "error");
        return;
      }
      // Abre numa aba nova: o URL é assinado e curto, e navegar a página para
      // ele deixava o painel fora do ecrã enquanto o browser decide.
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  const columns: TableColumn<StaffFile>[] = [
    {
      id: "name",
      header: t("columns.file"),
      cell: (file) => (
        <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", minWidth: 0 }}>
          {file.mime.startsWith("image/") ? (
            <ImageIcon size={15} color="var(--muted)" />
          ) : (
            <FileText size={15} color="var(--muted)" />
          )}
          <span
            style={{
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {file.name}
          </span>
          {/* De onde veio. Um anexo de correio guardado aqui (D66) não é a
              mesma coisa que um ficheiro que alguém carregou à mão, e a lista
              não devia obrigar a abrir para perceber a diferença. */}
          {file.source !== "upload" ? (
            <StatusTag tone="draft">{t(`source.${file.source}`)}</StatusTag>
          ) : null}
        </span>
      ),
    },
    { id: "owner", header: t("columns.owner"), cell: (file) => file.ownerName || "—" },
    {
      id: "size",
      header: t("columns.size"),
      cell: (file) => formatBytes(file.size),
      numeric: true,
    },
    {
      id: "created",
      header: t("columns.added"),
      cell: (file) => dateFormat.format(new Date(file.createdAt)),
    },
    {
      id: "actions",
      header: t("columns.actions"),
      align: "right",
      cell: (file) =>
        file.deletedAt ? (
          <Button
            size="sm"
            variant="ghost"
            leadingIcon={<RotateCcw size={14} />}
            disabled={pending}
            onClick={() => run(() => props.onRestore(file.id))}
          >
            {t("restore")}
          </Button>
        ) : (
          <span style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-1)" }}>
            <Button
              size="sm"
              variant="ghost"
              iconOnly
              aria-label={t("download")}
              title={t("download")}
              disabled={pending}
              onClick={() => download(file.id)}
            >
              <Download size={14} />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              iconOnly
              aria-label={t("delete")}
              title={t("delete")}
              disabled={pending}
              onClick={() => run(() => props.onDelete(file.id))}
            >
              <Trash2 size={14} />
            </Button>
          </span>
        ),
    },
  ];

  return (
    <div style={{ display: "grid", gap: "var(--sp-5)" }}>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <span style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
            <input
              ref={picker}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) upload(file);
              }}
            />
            <Button
              variant="secondary"
              leadingIcon={<FolderPlus size={15} />}
              disabled={pending}
              onClick={() => {
                const name = window.prompt(t("folderPrompt"));
                if (name?.trim()) run(() => props.onCreateFolder(name.trim()));
              }}
            >
              {t("newFolder")}
            </Button>
            <Button
              leadingIcon={<ArrowUpFromLine size={15} />}
              disabled={pending}
              onClick={() => picker.current?.click()}
            >
              {pending ? t("uploading") : t("upload")}
            </Button>
          </span>
        }
      />

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "var(--sp-2)",
        }}
      >
        <Button
          size="sm"
          variant={view === null ? "secondary" : "ghost"}
          aria-current={view === null ? "true" : undefined}
          onClick={() => setView(null)}
        >
          {t("allFiles", { count: live.length })}
        </Button>
        {props.folders.map((folder) => (
          <Button
            key={folder.id}
            size="sm"
            variant={view === folder.id ? "secondary" : "ghost"}
            aria-current={view === folder.id ? "true" : undefined}
            onClick={() => setView(folder.id)}
          >
            {folder.name}
          </Button>
        ))}
        {/* A reciclagem só aparece quando lá está alguma coisa: um separador
            permanentemente vazio é ruído em todos os dias menos um. */}
        {binned.length > 0 ? (
          <Button
            size="sm"
            variant={view === "bin" ? "secondary" : "ghost"}
            leadingIcon={<Trash2 size={14} />}
            aria-current={view === "bin" ? "true" : undefined}
            onClick={() => setView("bin")}
          >
            {t("recycleBin", { count: binned.length })}
          </Button>
        ) : null}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          title={view === "bin" ? t("emptyBin") : t("empty")}
          description={view === "bin" ? undefined : t("emptyHint")}
        />
      ) : (
        <Table
          caption={t("tableCaption")}
          columns={columns}
          rows={shown}
          rowKey={(file) => file.id}
        />
      )}
    </div>
  );
}
