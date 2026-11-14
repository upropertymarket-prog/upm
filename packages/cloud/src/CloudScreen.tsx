"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE, resolveLocale } from "@upm/config";
import {
  ArrowUpFromLine,
  ChevronRight,
  Cloud as CloudIcon,
  Download,
  FileText,
  Folder,
  FolderPlus,
  History,
  Image as ImageIcon,
  Inbox,
  Lock,
  RotateCcw,
  Share2,
  Trash2,
  Users,
} from "lucide-react";
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  StatusTag,
  Table,
  useToast,
  type TableColumn,
} from "@upm/ui";
import { formatBytes, type CloudStatus, type SharePermission } from "@upm/db/cloud";

import {
  folderSubtreeIds,
  formatDate,
  mimeLabel,
  type CloudFileRow,
  type CloudWriteResult,
  type FileAccessRow,
  type FileVersionRow,
  type FolderNode,
  type ShareContact,
  type SharedWithMeRow,
} from "./cloudTypes";
import { ShareFileModal, type ShareState } from "./ShareFileModal";

export type CloudFileDetails = {
  versions: FileVersionRow[];
  accesses: FileAccessRow[];
  shares: ShareState[];
};

export type CloudScreenProps = {
  /** Omitido = "Cloud" (`cloud.title`). A Cloud da equipa chama-se outra coisa. */
  title?: string;
  subtitle: string;
  /**
   * O consumo e, quando existe, o limite. Omitido = sem cartão de
   * armazenamento.
   *
   * As duas Clouds passam-no, e querem dizer coisas diferentes: na do cliente
   * o limite vem do plano e é **imposto** por `cloud_register_upload`; na da
   * equipa é o tecto de exemplo de `STAFF_CLOUD_LIMIT_BYTES`, que ninguém
   * impõe — o custo é da empresa (decisão de 26 out 2026). O ecrã não
   * distingue os dois, e não tem de: mostra a conta e a escala. O que o
   * distingue é `hasCloud`, que na da equipa é sempre verdadeiro.
   */
  status?: CloudStatus;
  /**
   * Preço do extra Cloud, já formatado, vindo de `addons` (P7-02). Nulo quando
   * o extra não está visível. Nunca se escreve um valor em euros neste
   * ficheiro: a grelha de 07 §8.3 é provisória (07 §9 #2).
   */
  cloudAddonPrice?: string | null;
  folders: FolderNode[];
  files: CloudFileRow[];
  /** Omitido = sem separador "Partilhados comigo". */
  sharedWithMe?: SharedWithMeRow[];
  contacts?: ShareContact[];
  /**
   * `false` = pastas a um nível só, e então o modal de nova pasta não promete
   * criá-la "dentro da pasta selecionada" nem passa `parentId`. É o caso da
   * Cloud da equipa: `staff_cloud_folder` não tem parâmetro de pasta-mãe, e um
   * subtítulo a dizer o contrário era o ecrã a prometer o que a escrita não faz.
   */
  canNestFolders?: boolean;
  onCreateFolder: (name: string, parentId?: string) => Promise<CloudWriteResult>;
  onUpload: (formData: FormData) => Promise<CloudWriteResult>;
  onDelete: (fileId: string) => Promise<CloudWriteResult>;
  onDownloadUrl: (
    fileId: string,
    action?: "view" | "download",
  ) => Promise<{ url?: string; error?: string }>;
  /** Omitido = sem botão "Substituir" na gaveta de detalhe. */
  onReplace?: (formData: FormData) => Promise<CloudWriteResult>;
  /** Omitido = a reciclagem só se esvazia, ficheiro a ficheiro não se repõe. */
  onRestore?: (fileId: string) => Promise<CloudWriteResult>;
  /** Omitido = sem botão "Esvaziar reciclagem". */
  onEmptyRecycleBin?: () => Promise<CloudWriteResult>;
  /** Omitido = sem coluna nem botão de partilha. Ver a nota de topo. */
  onShare?: (input: {
    fileId: string;
    permission: SharePermission;
    sharedWith?: string;
    asLink?: boolean;
    expiresInHours?: number | null;
    accessCode?: string;
  }) => Promise<{ ok?: boolean; url?: string; error?: string }>;
  onRevokeShare?: (shareId: string) => Promise<CloudWriteResult>;
  /** Omitido = sem botão "Detalhes" e sem gaveta. */
  onLoadDetails?: (fileId: string) => Promise<CloudFileDetails>;
  onRestoreVersion?: (fileId: string, version: number) => Promise<CloudWriteResult>;
};

/** `null` = "Todos os ficheiros"; os dois literais são as vistas especiais. */
type View =
  { kind: "all" } | { kind: "folder"; id: string } | { kind: "recycle" } | { kind: "shared" };

/**
 * Cloud — o ecrã, um só (P6-01 · P6-02 · 07 §19 · D71)
 * =========================================================================
 * Três colunas de leitura: as pastas à esquerda, os ficheiros ao centro, o
 * armazenamento em cima à direita.
 *
 * ## Um ecrã, quatro rotas (D71, 26 out 2026)
 *
 * `/cloud` na app, e `/suporte/cloud`, `/marketing/cloud` e `/admin/cloud` no
 * acesso interno — as três portas da **mesma** gaveta da equipa, uma por papel
 * de `is_internal()`. Todas montam **este** componente. Até aqui o lado interno
 * tinha ecrã próprio — o
 * `StaffCloud`, uma tabela sem pastas, sem detalhes e com outro cabeçalho — e
 * a razão era concreta: este ficheiro tinha ~200 frases em português escritas à
 * mão e não usava `next-intl`, logo não podia entrar num painel bilingue. D72
 * traduziu-o entre 19 e 21 out, e o motivo caiu. Ficava uma divergência sem
 * razão: duas Clouds que se pareciam cada vez menos, sobre a mesma tabela.
 *
 * ## O que muda entre elas são as *props*, nunca o desenho
 *
 * Cada diferença é a ausência de uma capacidade, não um ramo de código:
 *
 * - **Sem `onShare`**: não há coluna "Partilha" nem botão de partilhar. Na
 *   Cloud das pessoas partilhar é dar acesso a quem não o tinha; na da equipa
 *   toda a gente já o tem — `scope = 'staff'` **é** a partilha. Um botão ali só
 *   podia significar "para fora", que é outra funcionalidade.
 * - **Com `onRestore`**: a reciclagem repõe ficheiro a ficheiro. É o que o lado
 *   interno sabe fazer (`restore_staff_cloud_file`) e o lado do cliente não.
 * - **Com `ownerName` nas linhas**: a coluna "Carregado por". Numa gaveta
 *   partilhada é metade da informação útil; na Cloud de uma pessoa seria
 *   sempre o próprio nome, repetido em todas as linhas.
 *
 * ## Duas coisas que este ecrã faz ao contrário da referência visual
 *
 * 1. O cartão de armazenamento **não reparte o consumo por tipo** (07 §19.9).
 *    Fica a barra e "2,1 GB de 5 GB". Repartir era o sistema a arrumar o que é
 *    do utilizador — e uma das três fatias do protótipo, as fotografias, nem
 *    sequer vive na Cloud.
 * 2. Quem não tem Cloud no plano vê o convite de 07 §19.4 **no lugar do
 *    conteúdo**, e o convite muda conforme o que falta: quem está a 80 % de
 *    outro limite do plano é convidado a subir de plano, não a comprar o extra.
 */
export function CloudScreen(props: CloudScreenProps) {
  const t = useTranslations("cloud");
  const tCommon = useTranslations("common");
  const intlLocale = INTL_LOCALE[resolveLocale(useLocale())];
  const { status, folders, files, sharedWithMe, contacts } = props;
  const [view, setView] = useState<View>({ kind: "all" });
  const [newFolder, setNewFolder] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [detail, setDetail] = useState<CloudFileRow | null>(null);
  const [details, setDetails] = useState<CloudFileDetails | null>(null);
  const [share, setShare] = useState<CloudFileRow | null>(null);
  const [pending, startTransition] = useTransition();
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const replaceRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  const flatFolders = useMemo(() => folders.flatMap(flatten), [folders]);

  const live = files.filter((file) => file.deletedAt === null);
  const binned = files.filter((file) => file.deletedAt !== null);

  // As capacidades do ecrã, lidas das props. Cada uma é uma ausência possível,
  // e nenhuma é um `if` sobre *quem* está a ver — o ecrã não sabe se é a Cloud
  // de uma pessoa ou a da equipa, e é isso que o mantém um só.
  const canShare = Boolean(props.onShare);
  const canRestore = Boolean(props.onRestore);
  const canOpenDetails = Boolean(props.onLoadDetails);
  const canNestFolders = props.canNestFolders ?? true;
  const showStorage = status !== undefined;
  const showOwner = files.some((file) => file.ownerName);

  const visible = useMemo(() => {
    if (view.kind === "recycle") return binned;
    if (view.kind === "all" || view.kind === "shared") return live;
    const node = flatFolders.find((item) => item.id === view.id);
    if (!node) return live;
    const ids = new Set(folderSubtreeIds(node));
    return live.filter((file) => file.folderId !== null && ids.has(file.folderId));
  }, [view, live, binned, flatFolders]);

  /** A pasta onde um upload cai — só quando há uma pasta escolhida e escrevível. */
  const uploadFolderId =
    view.kind === "folder" &&
    flatFolders.find((item) => item.id === view.id)?.kind !== "property_documents"
      ? view.id
      : undefined;

  /**
   * `done` é o rótulo que o ecrã tem à mão; `notice` é a frase que a escrita
   * trouxe. Quando as duas existem ganha a da escrita, que sabe o que
   * aconteceu — "Ficheiro na reciclagem — fica lá 30 dias" diz mais do que
   * "Ficheiro movido para a reciclagem".
   */
  function run(work: () => Promise<CloudWriteResult>, done: string) {
    startTransition(async () => {
      const result = await work();
      if (result.error) toast(result.error, "error");
      else toast(result.notice ?? done, "success");
    });
  }

  function openFile(file: CloudFileRow) {
    const load = props.onLoadDetails;
    if (!load) return;
    setDetail(file);
    setDetails(null);
    startTransition(async () => setDetails(await load(file.id)));
  }

  function download(file: CloudFileRow, action: "view" | "download") {
    startTransition(async () => {
      const result = await props.onDownloadUrl(file.id, action);
      if (result.error || !result.url) {
        toast(result.error ?? t("openFailed"), "error");
        return;
      }
      window.open(result.url, "_blank", "noopener,noreferrer");
    });
  }

  // -------------------------------------------------------------------------
  // Sem Cloud no plano — 07 §19.1 e §19.4
  // -------------------------------------------------------------------------
  if (status && !status.hasCloud) {
    const nearLimit = status.nearPlanLimit;
    return (
      <>
        <PageHeader title={props.title ?? t("title")} subtitle={props.subtitle} />
        <Card padded style={{ display: "grid", gap: "var(--sp-6)", justifyItems: "start" }}>
          <span
            aria-hidden="true"
            style={{
              width: 44,
              height: 44,
              borderRadius: "var(--r-md)",
              background: "var(--accent-soft)",
              color: "var(--accent)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <CloudIcon size={22} />
          </span>
          <div style={{ display: "grid", gap: "var(--sp-3)", maxWidth: "62ch" }}>
            <strong style={{ fontSize: "var(--fs-title-sm)" }}>
              {nearLimit ? t("upsell.nearLimitTitle") : t("upsell.title")}
            </strong>
            <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
              {nearLimit ? t("upsell.nearLimitBody") : t("upsell.body")}
            </p>
          </div>
          <div style={{ display: "flex", gap: "var(--sp-4)", flexWrap: "wrap" }}>
            <a
              href="/plano"
              className="upm-btn upm-btn--primary upm-btn--md"
              style={{ textDecoration: "none" }}
            >
              {t("upsell.seePlans")}
            </a>
            {nearLimit || !props.cloudAddonPrice ? null : (
              <a
                href="/plano?extra=cloud"
                className="upm-btn upm-btn--secondary upm-btn--md"
                style={{ textDecoration: "none" }}
              >
                {t("upsell.addCloud", { price: props.cloudAddonPrice })}
              </a>
            )}
          </div>
        </Card>
      </>
    );
  }

  const columns: TableColumn<CloudFileRow>[] = [
    {
      id: "name",
      header: t("columns.file"),
      cell: (row) => (
        <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)", minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: 32,
              height: 32,
              borderRadius: "var(--r-sm)",
              background: "var(--surface2)",
              color: "var(--muted)",
              display: "grid",
              placeItems: "center",
              flex: "none",
            }}
          >
            {row.mime.startsWith("image/") ? <ImageIcon size={15} /> : <FileText size={15} />}
          </span>
          <div style={{ display: "grid", minWidth: 0 }}>
            <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {row.name}
            </strong>
            <span style={{ color: "var(--muted)" }}>
              {mimeLabel(row.mime, t("fileFallback"))} · {formatBytes(row.size)}
              {row.currentVersion > 1 ? ` · v${row.currentVersion}` : ""}
            </span>
          </div>
          {/* De onde veio. Um anexo de correio guardado aqui (D66) não é a
              mesma coisa que um ficheiro que alguém carregou à mão, e a lista
              não devia obrigar a abrir para perceber a diferença. */}
          {row.source !== "upload" && FILE_SOURCE_LABELS.has(row.source) ? (
            <StatusTag tone="draft">{t(`source.${row.source}`)}</StatusTag>
          ) : null}
          {row.readonly ? (
            <span title={t("readonlyHint")} style={{ color: "var(--muted)" }}>
              <Lock size={13} aria-label={t("readonlyBadge")} />
            </span>
          ) : null}
        </div>
      ),
    },
    ...(showOwner
      ? [
          {
            id: "owner",
            header: t("columns.owner"),
            cell: (row: CloudFileRow) => (
              <span style={{ color: "var(--muted)" }}>{row.ownerName || "—"}</span>
            ),
          },
        ]
      : []),
    ...(canShare
      ? [
          {
            id: "share",
            header: t("columns.share"),
            cell: (row: CloudFileRow) => (
              <span style={{ color: "var(--muted)" }}>
                {row.sharedLabel}
                {row.hasLink ? t("sharedViaLink") : ""}
              </span>
            ),
          },
        ]
      : []),
    {
      id: "date",
      header: t("columns.added"),
      cell: (row) => (
        <span style={{ color: "var(--muted)" }}>{formatDate(row.createdAt, intlLocale)}</span>
      ),
    },
    {
      id: "actions",
      header: t("columns.actions"),
      width: "240px",
      cell: (row) => (
        <div
          style={{
            display: "flex",
            gap: "var(--sp-2)",
            /* Os ícones são 40 px (`--tap`, 04 §1.8) e o "Detalhes" 36 px: sem
               `center` o flex alinhava-os pelo topo da célula. */
            alignItems: "center",
            justifyContent: "flex-end",
            flexWrap: "nowrap",
            whiteSpace: "nowrap",
          }}
        >
          <Button
            variant="secondary"
            iconOnly
            aria-label={t("downloadFile", { name: row.name })}
            onClick={() => download(row, "download")}
          >
            <Download size={16} />
          </Button>
          {/* Na reciclagem não se partilha nem se elimina outra vez — o que lá
              faz sentido é trazer de volta, e só onde isso existe. */}
          {row.deletedAt ? (
            canRestore ? (
              <Button
                variant="secondary"
                iconOnly
                disabled={pending}
                aria-label={t("restoreFile", { name: row.name })}
                onClick={() => run(() => props.onRestore!(row.id), t("toast.restored"))}
              >
                <RotateCcw size={16} />
              </Button>
            ) : null
          ) : (
            <>
              {canShare ? (
                <Button
                  variant="secondary"
                  iconOnly
                  aria-label={t("shareFile", { name: row.name })}
                  onClick={() => setShare(row)}
                >
                  <Share2 size={16} />
                </Button>
              ) : null}
              <Button
                variant="secondary"
                iconOnly
                disabled={row.readonly}
                aria-label={t("deleteFile", { name: row.name })}
                title={row.readonly ? t("cannotDelete") : undefined}
                onClick={() => run(() => props.onDelete(row.id), t("toast.binned"))}
              >
                <Trash2 size={16} />
              </Button>
            </>
          )}
          {/* Afasta-se do trio de ícones: o `gap` que chega entre ícones deixa
              o botão com rótulo demasiado colado a eles. */}
          {canOpenDetails ? (
            <Button
              variant="secondary"
              size="md"
              style={{ marginLeft: "var(--sp-3)" }}
              onClick={() => openFile(row)}
            >
              {t("details")}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const usedRatio =
    status?.limitBytes && status.limitBytes > 0
      ? Math.min(1, status.usedBytes / status.limitBytes)
      : 0;

  return (
    <>
      <PageHeader
        title={props.title ?? t("title")}
        subtitle={props.subtitle}
        actions={
          <>
            <Button
              variant="secondary"
              leadingIcon={<FolderPlus size={15} />}
              onClick={() => setNewFolder(true)}
            >
              {t("newFolder")}
            </Button>
            <Button
              leadingIcon={<ArrowUpFromLine size={15} />}
              disabled={pending}
              onClick={() => uploadRef.current?.click()}
            >
              {t("upload")}
            </Button>
            <input
              ref={uploadRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const form = new FormData();
                form.set("file", file);
                if (uploadFolderId) form.set("folderId", uploadFolderId);
                run(() => props.onUpload(form), t("toast.uploaded"));
              }}
            />
          </>
        }
      />
      <div
        className="upm-split"
        style={
          {
            "--split-cols": "minmax(200px, 248px) minmax(0, 1fr)",
            "--split-align": "stretch",
          } as React.CSSProperties
        }
      >
        {/* Coluna das pastas — sticky, como 04 §1.4 pede às colunas laterais,
            mas só enquanto *for* uma coluna: abaixo de 900 px passa para cima
            da lista de ficheiros, com a altura do que tem dentro em vez de uma
            janela de 100vh que deixava meio ecrã em branco. */}
        <Card
          padded
          className="upm-split__aside upm-split__aside--sticky"
          style={
            {
              "--split-aside-h":
                "calc(100vh - var(--topbar-h) - var(--sp-9) - var(--sp-7) - var(--sp-9) - 6rem)",
              display: "grid",
              gridTemplateRows: showStorage ? "1fr auto" : "1fr",
              gap: "var(--sp-6)",
            } as React.CSSProperties
          }
        >
          <div style={{ display: "grid", alignContent: "start", gap: "var(--sp-3)" }}>
            <NavRow
              label={t("navAll")}
              icon={<CloudIcon size={15} />}
              count={live.length}
              active={view.kind === "all"}
              onClick={() => setView({ kind: "all" })}
            />
            {folders.map((node) => (
              <FolderRow key={node.id} node={node} view={view} onSelect={setView} depth={0} />
            ))}
            {sharedWithMe ? (
              <NavRow
                label={t("navShared")}
                icon={<Inbox size={15} />}
                count={sharedWithMe.length}
                active={view.kind === "shared"}
                onClick={() => setView({ kind: "shared" })}
              />
            ) : null}
            {/* A reciclagem não é uma pasta (14 nov 2026, pedido do cliente):
                uma linha separa-a das pastas, no mesmo traço do armazenamento. */}
            <hr
              aria-hidden="true"
              style={{ margin: "var(--sp-2) 0", border: 0, borderTop: "1px solid var(--border)" }}
            />
            <NavRow
              label={t("navRecycle")}
              icon={<Trash2 size={15} />}
              count={binned.length}
              active={view.kind === "recycle"}
              onClick={() => setView({ kind: "recycle" })}
            />
          </div>

          {/* 07 §19.9 — barra e total, sem repartição por tipo. */}
          {showStorage ? (
            <div
              style={{
                display: "grid",
                gap: "var(--sp-4)",
                borderTop: "1px solid var(--border)",
                paddingTop: "var(--sp-6)",
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
              <span style={{ color: "var(--muted)" }}>
                {t("storageUsed", {
                  used: formatBytes(status!.usedBytes),
                  limit:
                    status!.limitBytes === null ? t("unlimited") : formatBytes(status!.limitBytes),
                })}
              </span>
            </div>
          ) : null}
        </Card>

        <div
          style={{
            display: "grid",
            gap: "var(--sp-6)",
            alignContent: "start",
            minWidth: 0,
          }}
        >
          <div style={{ display: "flex", gap: "var(--sp-4)", flexWrap: "wrap" }}>
            {view.kind === "recycle" && binned.length > 0 && props.onEmptyRecycleBin ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => run(props.onEmptyRecycleBin!, t("toast.recycleEmptied"))}
              >
                {t("emptyRecycleBin")}
              </Button>
            ) : null}
          </div>

          {view.kind === "shared" ? (
            <SharedWithMeList
              rows={sharedWithMe ?? []}
              onOpen={(fileId) => download({ id: fileId } as CloudFileRow, "download")}
            />
          ) : visible.length === 0 ? (
            <EmptyState
              title={view.kind === "recycle" ? t("recycleEmptyTitle") : t("emptyTitle")}
              description={view.kind === "recycle" ? t("recycleEmptyBody") : t("emptyBody")}
            />
          ) : (
            <Card>
              <Table
                caption={t("tableCaption")}
                columns={columns}
                rows={visible}
                rowKey={(row) => row.id}
                empty={t("tableEmpty")}
              />
            </Card>
          )}
        </div>

        <Modal
          open={newFolder}
          onClose={() => setNewFolder(false)}
          title={t("newFolder")}
          subtitle={view.kind === "folder" && canNestFolders ? t("newFolderIn") : undefined}
          size="sm"
          footer={
            <>
              <Button variant="secondary" onClick={() => setNewFolder(false)}>
                {tCommon("cancel")}
              </Button>
              <Button
                disabled={pending || folderName.trim().length === 0}
                onClick={() => {
                  const name = folderName.trim();
                  const parent = view.kind === "folder" && canNestFolders ? view.id : undefined;
                  setNewFolder(false);
                  setFolderName("");
                  run(() => props.onCreateFolder(name, parent), t("toast.folderCreated"));
                }}
              >
                {t("create")}
              </Button>
            </>
          }
        >
          <Input
            label={t("folderName")}
            value={folderName}
            onChange={(event) => setFolderName(event.target.value)}
            placeholder={t("folderNamePlaceholder")}
            maxLength={120}
          />
        </Modal>

        {props.onShare && props.onRevokeShare ? (
          <ShareFileModal
            file={share}
            contacts={contacts ?? []}
            shares={share && detail?.id === share.id ? (details?.shares ?? []) : []}
            onClose={() => setShare(null)}
            onShare={props.onShare}
            onRevoke={props.onRevokeShare}
          />
        ) : null}

        <Drawer
          open={detail !== null}
          onClose={() => setDetail(null)}
          title={detail?.name ?? t("fileFallback")}
          subtitle={
            detail
              ? `${mimeLabel(detail.mime, t("fileFallback"))} · ${formatBytes(detail.size)}`
              : undefined
          }
          footer={
            <>
              <Button variant="secondary" onClick={() => setDetail(null)}>
                {tCommon("close")}
              </Button>
              {detail && !detail.readonly && props.onReplace ? (
                <Button disabled={pending} onClick={() => replaceRef.current?.click()}>
                  {t("replace")}
                </Button>
              ) : null}
            </>
          }
        >
          {props.onReplace ? (
            <input
              ref={replaceRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file || !detail) return;
                const form = new FormData();
                form.set("file", file);
                form.set("fileId", detail.id);
                run(() => props.onReplace!(form), t("toast.versionSaved"));
                setDetail(null);
              }}
            />
          ) : null}

          <div style={{ display: "grid", gap: "var(--sp-7)" }}>
            {detail?.readonly ? (
              <p style={{ margin: 0, color: "var(--muted)", lineHeight: 1.6 }}>
                {t("readonlyNote")}
              </p>
            ) : null}

            <section style={{ display: "grid", gap: "var(--sp-4)" }}>
              <strong style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
                <History size={15} aria-hidden="true" /> {t("versions")}
              </strong>
              {details === null ? (
                <span style={{ color: "var(--muted)" }}>{tCommon("loading")}</span>
              ) : details.versions.length === 0 ? (
                <span style={{ color: "var(--muted)" }}>{t("noVersions")}</span>
              ) : (
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "grid",
                    gap: "var(--sp-4)",
                  }}
                >
                  {details.versions.map((version) => (
                    <li
                      key={version.version}
                      style={{ display: "flex", alignItems: "center", gap: "var(--sp-4)" }}
                    >
                      <StatusTag
                        tone={version.version === detail?.currentVersion ? "active" : "archived"}
                      >
                        v{version.version}
                      </StatusTag>
                      <div style={{ display: "grid", minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {version.name}
                        </span>
                        <span style={{ color: "var(--muted)" }}>
                          {formatDate(version.createdAt, intlLocale)} · {formatBytes(version.size)}
                          {version.note ? ` · ${version.note}` : ""}
                        </span>
                      </div>
                      {detail &&
                      !detail.readonly &&
                      props.onRestoreVersion &&
                      version.version !== detail.currentVersion ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            const id = detail.id;
                            setDetail(null);
                            run(
                              () => props.onRestoreVersion!(id, version.version),
                              t("toast.versionRestored"),
                            );
                          }}
                        >
                          {t("restore")}
                        </Button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section style={{ display: "grid", gap: "var(--sp-4)" }}>
              <strong style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)" }}>
                <Users size={15} aria-hidden="true" /> {t("accesses")}
              </strong>
              {details === null ? (
                <span style={{ color: "var(--muted)" }}>{tCommon("loading")}</span>
              ) : details.accesses.length === 0 ? (
                <span style={{ color: "var(--muted)" }}>{t("noAccesses")}</span>
              ) : (
                <ul
                  style={{
                    margin: 0,
                    padding: 0,
                    listStyle: "none",
                    display: "grid",
                    gap: "var(--sp-3)",
                  }}
                >
                  {details.accesses.slice(0, 20).map((access, index) => (
                    <li key={index} style={{ display: "grid" }}>
                      <span>
                        {ACCESS_ACTIONS.has(access.action)
                          ? t(`access.${access.action}`)
                          : access.action}{" "}
                        · {access.actorName}
                        {access.viaLink ? t("accessViaLink") : ""}
                      </span>
                      <span style={{ color: "var(--muted)" }}>
                        {formatDate(access.occurredAt, intlLocale)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </Drawer>
      </div>
    </>
  );
}

/**
 * As ações que têm chave em `cloud.access.*`. A guarda existe porque
 * `audit`/`file_access` podem ganhar uma ação nova na base de dados antes de
 * alguém lhe escrever o rótulo, e `t()` de uma chave que não existe grita em
 * desenvolvimento e imprime a chave em produção. Sem rótulo, mostra-se o nome
 * técnico — feio, mas honesto.
 */
const ACCESS_ACTIONS = new Set([
  "view",
  "download",
  "export_pdf",
  "print",
  "share_created",
  "share_revoked",
]);

/**
 * As origens que têm chave em `cloud.source.*` — a mesma guarda, pela mesma
 * razão: `file_source` é um enum da base de dados e ganha valores sem passar
 * por aqui. Sem rótulo, não há etiqueta; uma etiqueta a dizer
 * `cloud.source.whatever` era pior do que nenhuma.
 */
const FILE_SOURCE_LABELS = new Set([
  "property_document",
  "message_attachment",
  "contract",
  "invoice",
  "mail_attachment",
  "campaign_report",
]);

function flatten(node: FolderNode): FolderNode[] {
  return [node, ...node.children.flatMap(flatten)];
}

function NavRow({
  label,
  icon,
  count,
  active,
  depth = 0,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  count: number;
  active: boolean;
  depth?: number;
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
        minHeight: 36,
        padding: `0 var(--sp-3) 0 calc(var(--sp-3) + ${depth * 14}px)`,
        border: "none",
        borderRadius: "var(--r-sm)",
        background: active ? "var(--accent-soft)" : "transparent",
        color: active ? "var(--accent)" : "var(--text)",
        font: "inherit",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <span aria-hidden="true" style={{ display: "grid", placeItems: "center", flex: "none" }}>
        {icon}
      </span>
      {/* `minWidth: 0`: `flex: 1` dá-lhe uma base de 0 mas não lhe tira o
          mínimo de conteúdo, e sem isso o nome de uma pasta comprida alargava
          o botão em vez de ganhar o `…`. */}
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
      {count > 0 ? <span style={{ color: "var(--muted)" }}>{count}</span> : null}
    </button>
  );
}

function FolderRow({
  node,
  view,
  onSelect,
  depth,
}: {
  node: FolderNode;
  view: View;
  onSelect: (view: View) => void;
  depth: number;
}) {
  return (
    <>
      <NavRow
        label={node.name}
        icon={node.kind === "user" ? <Folder size={15} /> : <ChevronRight size={15} />}
        count={node.fileCount}
        depth={depth}
        active={view.kind === "folder" && view.id === node.id}
        onClick={() => onSelect({ kind: "folder", id: node.id })}
      />
      {node.children.map((child) => (
        <FolderRow key={child.id} node={child} view={view} onSelect={onSelect} depth={depth + 1} />
      ))}
    </>
  );
}

/**
 * 05 §6.4 — "um documento partilhado com um comprador aparece na Cloud do
 * comprador". Lista separada de propósito: são ficheiros de outra pessoa, e o
 * que se pode fazer com eles é outro (ver ou transferir, conforme a permissão).
 */
function SharedWithMeList({
  rows,
  onOpen,
}: {
  rows: SharedWithMeRow[];
  onOpen: (fileId: string) => void;
}) {
  const t = useTranslations("cloud");
  const intlLocale = INTL_LOCALE[resolveLocale(useLocale())];
  if (rows.length === 0) {
    return <EmptyState title={t("sharedEmptyTitle")} description={t("sharedEmptyBody")} />;
  }

  return (
    <Card>
      <Table
        caption={t("sharedCaption")}
        rows={rows}
        rowKey={(row) => row.shareId}
        empty={t("sharedTableEmpty")}
        columns={[
          {
            id: "name",
            header: t("columns.file"),
            cell: (row) => (
              <div style={{ display: "grid", minWidth: 0 }}>
                <strong>{row.name}</strong>
                <span style={{ color: "var(--muted)" }}>
                  {mimeLabel(row.mime, t("fileFallback"))} · {formatBytes(row.size)}
                </span>
              </div>
            ),
          },
          {
            id: "by",
            header: t("columns.sharedBy"),
            cell: (row) => <span style={{ color: "var(--muted)" }}>{row.sharedByName}</span>,
          },
          {
            id: "expires",
            header: t("columns.expires"),
            cell: (row) => (
              <span style={{ color: "var(--muted)" }}>
                {row.expiresAt ? formatDate(row.expiresAt, intlLocale) : t("noExpiry")}
              </span>
            ),
          },
          {
            id: "actions",
            header: t("columns.actions"),
            cell: (row) => (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button
                  variant="ghost"
                  size="sm"
                  leadingIcon={<Download size={14} />}
                  onClick={() => onOpen(row.fileId)}
                >
                  {row.permission === "download" ? t("transfer") : t("view")}
                </Button>
              </div>
            ),
          },
        ]}
      />
    </Card>
  );
}
