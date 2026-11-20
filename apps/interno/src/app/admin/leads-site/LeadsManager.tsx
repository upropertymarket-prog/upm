"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Download, Info, MessageSquareText, Trash2, UsersRound } from "lucide-react";
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  Input,
  Modal,
  Pagination,
  Select,
  StatusTag,
  Table,
  Textarea,
  useClickOutside,
  type TableColumn,
} from "@upm/ui";
import type { Database } from "@upm/db";
import { useStepUp } from "../../../components/StepUpModal";
import { useDrawerNavigation } from "../../../lib/useDrawerNavigation";
import type { VerifyPinAction } from "../../../components/stepUpTypes";
import type { LeadActionResult, LeadFilters } from "./actions";

type LeadRow = Database["public"]["Functions"]["admin_list_site_leads"]["Returns"][number];
type LeadDetail = Database["public"]["Functions"]["admin_site_lead_detail"]["Returns"][number];
type LeadEvent = Database["public"]["Functions"]["admin_site_lead_history"]["Returns"][number];
type LeadStatus = "new" | "contacted" | "qualified" | "converted" | "discarded";
type Cursor = { createdAt: string; id: string };
type PageInfo = {
  page: number;
  pageCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
  firstCursor: Cursor | null;
  lastCursor: Cursor | null;
};

function labelDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "pt-PT", {
    dateStyle: "medium",
  }).format(new Date(value));
}
function utmEntries(value: unknown): Array<[string, string]> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  return ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]
    .filter((key) => typeof record[key] === "string" && Boolean((record[key] as string).trim()))
    .map((key) => [key.replace("utm_", ""), (record[key] as string).trim()]);
}
function href(filters: LeadFilters, extra: Record<string, string | null> = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.source) params.set("source", filters.source);
  if (filters.form) params.set("form", filters.form);
  if (filters.assignedTo) params.set("assigned_to", filters.assignedTo);
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const query = params.toString();
  return query ? "/admin/leads-site?" + query : "/admin/leads-site";
}
function statusTone(status: LeadStatus): "active" | "pending" | "rejected" | "primary" {
  if (status === "new") return "pending";
  if (status === "discarded") return "rejected";
  if (status === "converted") return "primary";
  return "active";
}

export function LeadsManager({
  rows,
  filters,
  staff,
  pageInfo,
  selected: loadedLead,
  history,
  detailError: loadedDetailError,
  loadError,
  locale,
  onUpdate,
  onAddNote,
  onExport,
  onDelete,
  onVerifyPin,
}: {
  rows: LeadRow[];
  filters: LeadFilters;
  staff: Array<{ id: string; full_name: string }>;
  pageInfo: PageInfo;
  selected: LeadDetail | null;
  history: LeadEvent[];
  detailError: boolean;
  loadError: boolean;
  locale: string;
  onUpdate: (input: {
    leadId: string;
    status: LeadStatus;
    assignedTo: string | null;
  }) => Promise<LeadActionResult>;
  onAddNote: (input: { leadId: string; note: string }) => Promise<LeadActionResult>;
  onExport: (
    input: LeadFilters,
  ) => Promise<LeadActionResult & { csv?: string; truncated?: boolean }>;
  onDelete: (leadId: string) => Promise<LeadActionResult>;
  onVerifyPin: VerifyPinAction;
}) {
  const t = useTranslations("admin.leads");
  const tp = useTranslations("pagination");
  const tc = useTranslations("common");
  const { navigate, refresh, intent } = useDrawerNavigation();
  // Enquanto a navegação corre, manda o clique: a gaveta abre (ou fecha) já, e
  // a ficha que estava aberta não fica à vista à espera do servidor.
  const selected = intent
    ? intent.id && loadedLead?.id === intent.id
      ? loadedLead
      : null
    : loadedLead;
  const detailError = intent ? false : loadedDetailError;
  const openingLabel = intent?.id && !selected ? (intent.label ?? "") : null;
  const [status, setStatus] = useState<LeadStatus>((selected?.status as LeadStatus) ?? "new");
  const [assignedTo, setAssignedTo] = useState<string>(selected?.assigned_to ?? "");
  const [note, setNote] = useState("");
  const [error, setError] = useState(false);
  // A página já não recarrega ao trocar de ficha, e o estado do formulário da
  // gaveta não pode passar de um lead para o seguinte.
  const [formLeadId, setFormLeadId] = useState(loadedLead?.id ?? null);
  if ((loadedLead?.id ?? null) !== formLeadId) {
    setFormLeadId(loadedLead?.id ?? null);
    setStatus((loadedLead?.status as LeadStatus) ?? "new");
    setAssignedTo(loadedLead?.assigned_to ?? "");
    setNote("");
    setError(false);
  }
  const [exportNotice, setExportNotice] = useState<"failed" | "truncated" | null>(null);
  const [saving, startSaving] = useTransition();
  const { requestStepUp, stepUpModal } = useStepUp(onVerifyPin);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useClickOutside<HTMLDivElement>(infoOpen, () => setInfoOpen(false));
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; email: string } | null>(null);
  const [deleteFailed, setDeleteFailed] = useState(false);

  const columns: TableColumn<LeadRow>[] = [
    {
      id: "name",
      header: t("name"),
      cell: (row) => (
        <span className="grid">
          <strong>{row.name}</strong>
          <span className="text-sm text-muted">{row.email}</span>
        </span>
      ),
    },
    { id: "profile", header: t("profileType"), cell: (row) => t("profile." + row.profile_type) },
    { id: "source", header: t("source"), cell: (row) => t("sources." + row.source) },
    { id: "form", header: t("form"), cell: (row) => t("forms." + row.form) },
    {
      id: "status",
      header: t("status"),
      cell: (row) => (
        <StatusTag tone={statusTone(row.status as LeadStatus)}>
          {t("statuses." + row.status)}
        </StatusTag>
      ),
    },
    {
      id: "assigned",
      header: t("assignedTo"),
      cell: (row) => row.assigned_name || t("unassigned"),
    },
    { id: "created", header: t("createdAt"), cell: (row) => labelDate(row.created_at, locale) },
    {
      id: "actions",
      header: <span className="upm-sr-only">{t("actions")}</span>,
      align: "right",
      width: "56px",
      // A linha inteira abre a ficha, também com Enter e espaço: sem parar a
      // propagação, o clique e o teclado no botão abriam a gaveta por baixo do
      // modal.
      cell: (row) => (
        <Button
          variant="ghost"
          iconOnly
          aria-label={t("deleteLeadNamed", { email: row.email })}
          title={t("deleteLead")}
          onClick={(event) => {
            event.stopPropagation();
            setDeleteFailed(false);
            setDeleteTarget({ id: row.id, email: row.email });
          }}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <Trash2 size={16} />
        </Button>
      ),
    },
  ];

  function changePage(nextPage: number) {
    if (nextPage === pageInfo.page) return;
    if (nextPage === 1) return navigate(href(filters));
    const next = nextPage > pageInfo.page;
    const cursor = next ? pageInfo.lastCursor : pageInfo.firstCursor;
    if (!cursor) return;
    navigate(
      href(filters, {
        cursor_created_at: cursor.createdAt,
        cursor_id: cursor.id,
        direction: next ? "next" : "prev",
        page: String(nextPage),
      }),
    );
  }
  function saveLead() {
    if (!selected) return;
    startSaving(async () => {
      const result = await onUpdate({
        leadId: selected.id,
        status,
        assignedTo: assignedTo || null,
      });
      setError(!result.ok);
      if (result.ok) refresh();
    });
  }
  function saveNote() {
    if (!selected || !note.trim()) return;
    startSaving(async () => {
      const result = await onAddNote({ leadId: selected.id, note });
      setError(!result.ok);
      if (!result.ok) return;
      setNote("");
      refresh();
    });
  }
  function cancelLeadChanges() {
    if (!selected) return;
    setStatus(selected.status as LeadStatus);
    setAssignedTo(selected.assigned_to ?? "");
    setError(false);
  }
  function cancelNote() {
    setNote("");
    setError(false);
  }
  function deleteLead() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startSaving(async () => {
      setDeleteFailed(false);
      const result = await onDelete(target.id);
      if (result.needsStepUp) {
        requestStepUp(() => deleteLead());
        return;
      }
      if (!result.ok) {
        setDeleteFailed(true);
        return;
      }
      setDeleteTarget(null);
      // A ficha aberta era a da lead apagada: fecha-se, em vez de ficar a
      // mostrar o erro de "não foi possível carregar".
      if (selected?.id === target.id) navigate(href(filters), { id: null });
      else refresh();
    });
  }
  function exportCsv() {
    startSaving(async () => {
      setExportNotice(null);
      const result = await onExport(filters);
      if (result.needsStepUp) {
        requestStepUp(() => exportCsv());
        return;
      }
      if (!result.ok || !result.csv) {
        setExportNotice("failed");
        return;
      }
      // O ficheiro sai na mesma, mas quem o abre tem de saber que não está
      // completo — o defeito antigo era precisamente parecer completo.
      if (result.truncated) setExportNotice("truncated");
      const blob = new Blob(["\uFEFF", result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      // A exportação é também o backup diário dos leads (12 §34.5, decisão de
      // 5 nov 2026): com a data e a hora no nome, a cópia de hoje não apaga a
      // de ontem na pasta de transferências de quem a faz.
      const carimbo = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "h");
      link.download = `leads-site_${carimbo}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  return (
    <>
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-1">
              <h1 className="text-2xl font-semibold text-text">{t("title")}</h1>
              {/* As regras de retenção e da cópia diária (8 nov 2026) estavam em
                  texto corrido por cima dos filtros. São para consultar, não
                  para ler todos os dias: ficam atrás de um ícone (20 nov 2026). */}
              <div ref={infoRef} className="relative">
                <Button
                  variant="ghost"
                  iconOnly
                  aria-label={t("retentionInfo")}
                  aria-expanded={infoOpen}
                  aria-controls="leads-retention-info"
                  title={t("retentionInfo")}
                  onClick={() => setInfoOpen((open) => !open)}
                >
                  <Info size={17} />
                </Button>
                {infoOpen ? (
                  <div
                    id="leads-retention-info"
                    role="region"
                    aria-label={t("retentionInfo")}
                    className="absolute left-0 top-full z-20 mt-2 grid w-[min(36rem,calc(100vw-2rem))] gap-2 rounded-xl border border-border bg-surface p-4 text-text"
                    style={{ boxShadow: "var(--shadow-lg)", fontSize: "var(--fs-body)" }}
                  >
                    <p>{t("retentionNote")}</p>
                    <p className="text-muted">{t("exportRetention")}</p>
                  </div>
                ) : null}
              </div>
            </div>
            <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
          </div>
          <Button
            variant="secondary"
            leadingIcon={<Download size={16} />}
            disabled={saving}
            onClick={exportCsv}
          >
            {t("export")}
          </Button>
        </header>
        {exportNotice ? (
          <p
            className={exportNotice === "failed" ? "text-sm text-danger" : "text-sm text-muted"}
            role={exportNotice === "failed" ? "alert" : "status"}
          >
            {exportNotice === "failed" ? t("exportFailed") : t("exportTruncated")}
          </p>
        ) : null}
        <Card padded>
          {/* Uma linha só (19 nov 2026): a pesquisa cresce o dobro dos selects, e
              o botão fica no fim da linha, alinhado pela base dos campos. Num
              ecrã estreito a linha parte-se sozinha, sem media queries. */}
          <form action="/admin/leads-site" method="get" className="flex flex-wrap items-end gap-3">
            <Input
              className="min-w-0 flex-[2_1_14rem]"
              name="search"
              label={t("search")}
              placeholder={t("searchHint")}
              defaultValue={filters.search}
            />
            <Select
              className="min-w-0 flex-[1_1_8.5rem]"
              name="status"
              label={t("statusFilter")}
              defaultValue={filters.status ?? ""}
              placeholder={t("allStatuses")}
              options={(["new", "contacted", "qualified", "converted", "discarded"] as const).map(
                (key) => ({ value: key, label: t("statuses." + key) }),
              )}
            />
            <Select
              className="min-w-0 flex-[1_1_8.5rem]"
              name="source"
              label={t("sourceFilter")}
              defaultValue={filters.source ?? ""}
              placeholder={t("allSources")}
              options={(["pre_launch", "post_launch"] as const).map((key) => ({
                value: key,
                label: t("sources." + key),
              }))}
            />
            <Select
              className="min-w-0 flex-[1_1_8.5rem]"
              name="form"
              label={t("formFilter")}
              defaultValue={filters.form ?? ""}
              placeholder={t("allForms")}
              options={(["preinscricao", "contacto", "empresas"] as const).map((key) => ({
                value: key,
                label: t("forms." + key),
              }))}
            />
            <Select
              className="min-w-0 flex-[1_1_8.5rem]"
              name="assigned_to"
              label={t("assignedTo")}
              defaultValue={filters.assignedTo ?? ""}
              placeholder={t("allStaff")}
              options={staff.map((member) => ({ value: member.id, label: member.full_name }))}
            />
            <Button type="submit" className="shrink-0">
              {t("applyFilters")}
            </Button>
          </form>
        </Card>
        <Card padded>
          {loadError ? (
            <EmptyState icon={<UsersRound size={36} />} title={t("loadFailed")} />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<UsersRound size={36} />}
              title={t(
                filters.search ||
                  filters.status ||
                  filters.source ||
                  filters.form ||
                  filters.assignedTo
                  ? "noResultsTitle"
                  : "emptyTitle",
              )}
              description={t("emptyDescription")}
            />
          ) : (
            <>
              <Table
                caption={t("tableCaption")}
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                selectedKey={selected?.id}
                onRowClick={(row) =>
                  navigate(href(filters, { id: row.id }), { id: row.id, label: row.email })
                }
              />
              <Pagination
                page={pageInfo.page}
                pageCount={pageInfo.pageCount}
                summary={t("resultsRange", {
                  from: (pageInfo.page - 1) * 25 + 1,
                  to: (pageInfo.page - 1) * 25 + rows.length,
                })}
                labels={{ previous: tp("previous"), next: tp("next"), page: t("pageLabel") }}
                onPageChange={changePage}
              />
            </>
          )}
        </Card>
      </div>
      {selected ? (
        <Drawer
          open
          title={t("detailTitle")}
          subtitle={selected.email}
          closeLabel={t("closeDrawer")}
          onClose={() => navigate(href(filters), { id: null })}
        >
          {detailError ? (
            <p role="alert" className="text-sm text-danger">
              {t("detailFailed")}
            </p>
          ) : (
            <div className="grid gap-5">
              <section className="grid gap-2">
                <h3 className="font-semibold text-text">{t("contact")}</h3>
                <p>{selected.name}</p>
                <p>
                  <a
                    className="text-accent underline"
                    href={"mailto:" + encodeURIComponent(selected.email)}
                  >
                    {selected.email}
                  </a>
                </p>
                <p>{selected.phone || "—"}</p>
                <p className="text-sm text-muted">
                  {t("profile." + selected.profile_type)} · {t("sources." + selected.source)} ·{" "}
                  {t("forms." + selected.form)}
                </p>
                {/* Desde 20 nov 2026 a pré-inscrição não confirma por e-mail; a
                    etiqueta fica para quem confirmou antes disso. */}
                {selected.confirmed_at ? (
                  <p>
                    <StatusTag tone="active">
                      {t("confirmedOn", { date: labelDate(selected.confirmed_at, locale) })}
                    </StatusTag>
                  </p>
                ) : null}
              </section>
              <section className="grid gap-2">
                <h3 className="font-semibold text-text">{t("request")}</h3>
                <p className="text-sm">{selected.reason || "—"}</p>
                <p className="whitespace-pre-wrap text-sm text-muted">
                  {selected.message || t("noMessage")}
                </p>
                {utmEntries(selected.utm).length > 0 ? (
                  <p className="text-muted" style={{ fontSize: "var(--fs-body)" }}>
                    {t("campaign")}:{" "}
                    {utmEntries(selected.utm)
                      .map(([key, value]) => `${key}=${value}`)
                      .join(" · ")}
                  </p>
                ) : null}
                <p className="text-muted" style={{ fontSize: "var(--fs-body)" }}>
                  {t("marketingConsent")}: {selected.consent_marketing ? t("yes") : t("no")}
                  {selected.consent_at ? " · " + labelDate(selected.consent_at, locale) : ""}
                </p>
              </section>
              <section className="grid gap-3">
                <h3 className="font-semibold text-text">{t("manage")}</h3>
                <Select
                  label={t("status")}
                  value={status}
                  onChange={(event) => setStatus(event.target.value as LeadStatus)}
                  options={(
                    ["new", "contacted", "qualified", "converted", "discarded"] as const
                  ).map((key) => ({ value: key, label: t("statuses." + key) }))}
                />
                <Select
                  label={t("assignedTo")}
                  value={assignedTo}
                  onChange={(event) => setAssignedTo(event.target.value)}
                  options={[
                    { value: "", label: t("unassigned") },
                    ...staff.map((member) => ({ value: member.id, label: member.full_name })),
                  ]}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="secondary" disabled={saving} onClick={cancelLeadChanges}>
                    {tc("cancel")}
                  </Button>
                  <Button disabled={saving} onClick={saveLead}>
                    {tc("saveChanges")}
                  </Button>
                </div>
              </section>
              <section className="grid gap-3">
                <h3 className="font-semibold text-text">{t("notes")}</h3>
                <Textarea
                  label={t("addNote")}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  maxLength={2000}
                />
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="secondary" disabled={saving} onClick={cancelNote}>
                    {tc("cancel")}
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={saving || !note.trim()}
                    leadingIcon={<MessageSquareText size={16} />}
                    onClick={saveNote}
                  >
                    {t("saveNote")}
                  </Button>
                </div>
              </section>
              <section className="grid gap-3">
                <h3 className="font-semibold text-text">{t("history")}</h3>
                {history.length ? (
                  <ol className="grid gap-3">
                    {history.map((item) => (
                      <li key={item.id} className="border-l-2 border-border pl-3">
                        <p className="text-sm font-medium">
                          {item.kind === "note"
                            ? t("noteEvent")
                            : item.kind === "status"
                              ? t("statusEvent")
                              : t("assignmentEvent")}
                        </p>
                        <p className="whitespace-pre-wrap text-sm text-muted">{item.body}</p>
                        <p className="text-muted" style={{ fontSize: "var(--fs-body)" }}>
                          {item.actor_name} · {labelDate(item.created_at, locale)}
                        </p>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-sm text-muted">{t("noHistory")}</p>
                )}
              </section>
              {error ? (
                <p className="text-sm text-danger" role="alert">
                  {t("actionFailed")}
                </p>
              ) : null}
            </div>
          )}
        </Drawer>
      ) : openingLabel !== null ? (
        <Drawer
          open
          title={t("detailTitle")}
          subtitle={openingLabel}
          closeLabel={t("closeDrawer")}
          onClose={() => navigate(href(filters), { id: null })}
        >
          <p role="status" className="text-sm text-muted">
            {tc("loading")}
          </p>
        </Drawer>
      ) : detailError ? (
        <Drawer
          open
          title={t("detailTitle")}
          closeLabel={t("closeDrawer")}
          onClose={() => navigate(href(filters), { id: null })}
        >
          <p role="alert" className="text-sm text-danger">
            {t("detailFailed")}
          </p>
        </Drawer>
      ) : null}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        size="sm"
        title={t("deleteTitle")}
        icon={<Trash2 size={17} />}
        closeLabel={tc("close")}
      >
        <div className="grid gap-4">
          <div className="grid gap-2 text-sm">
            <p className="text-text">{t("deleteBody", { email: deleteTarget?.email ?? "" })}</p>
            <p className="text-muted">{t("deleteCopiesNote")}</p>
          </div>
          {deleteFailed ? (
            <p className="text-sm text-danger" role="alert">
              {t("deleteFailed")}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)}>
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              leadingIcon={<Trash2 size={16} />}
              disabled={saving}
              onClick={deleteLead}
            >
              {t("confirmDelete")}
            </Button>
          </div>
        </div>
      </Modal>
      {stepUpModal}
    </>
  );
}
