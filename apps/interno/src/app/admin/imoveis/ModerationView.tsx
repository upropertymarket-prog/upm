"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, RotateCcw, Star, X } from "lucide-react";
import {
  Button,
  Card,
  Drawer,
  EmptyState,
  Modal,
  Pagination,
  StatusTag,
  Table,
  Textarea,
  type TableColumn,
} from "@upm/ui";
import type { Database } from "@upm/db";

import { useStepUp } from "../../../components/StepUpModal";
import type { VerifyPinAction } from "../../../components/stepUpTypes";
import type { ModerationActionResult } from "./actions";

type PropertyStatus = Database["public"]["Enums"]["property_status"];
type ListRow = Database["public"]["Functions"]["admin_list_moderation"]["Returns"][number] & {
  coverUrl: string | null;
};
type DetailRow = Database["public"]["Functions"]["admin_moderation_detail"]["Returns"][number];
type HistoryRow =
  Database["public"]["Functions"]["admin_property_moderation_history"]["Returns"][number];
type ActionName = "approve" | "reject" | "feature" | "unfeature" | "reopen";

type Cursor = { createdAt: string; id: string };
type PageInfo = {
  page: number;
  pageCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
  firstCursor: Cursor | null;
  lastCursor: Cursor | null;
};

function statusTone(status: PropertyStatus): "active" | "pending" | "rejected" | "primary" {
  if (status === "pending_review") return "pending";
  if (status === "rejected") return "rejected";
  if (status === "featured") return "primary";
  return "active";
}

function dateLabel(value: string | null, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "pt-PT", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function makeHref(status: PropertyStatus, extra: Record<string, string | null> = {}) {
  const params = new URLSearchParams({ status });
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  return "/admin/imoveis?" + params.toString();
}

export function ModerationView({
  status,
  properties,
  counts,
  pageInfo,
  selectedProperty,
  media,
  documents,
  history,
  exactLocation,
  selectedPropertyError,
  loadError,
  locale,
  onModerate,
  onVerifyPin,
}: {
  status: PropertyStatus;
  properties: ListRow[];
  counts: Record<string, number>;
  pageInfo: PageInfo;
  selectedProperty: DetailRow | null;
  media: Array<{
    id: string;
    kind: string;
    position: number;
    is_cover: boolean;
    signedUrl: string | null;
  }>;
  documents: Array<{
    id: string;
    name: string;
    mime: string;
    size: number;
    kind: string;
    signedUrl: string | null;
  }>;
  history: HistoryRow[];
  exactLocation: string | null;
  selectedPropertyError: boolean;
  loadError: boolean;
  locale: string;
  onModerate: (input: {
    propertyId: string;
    action: ActionName;
    reason: string;
  }) => Promise<ModerationActionResult>;
  onVerifyPin: VerifyPinAction;
}) {
  const t = useTranslations("admin.moderation");
  const tc = useTranslations("common");
  const tp = useTranslations("pagination");
  const [actionTarget, setActionTarget] = useState<ActionName | null>(null);
  const [reason, setReason] = useState("");
  const [actionFailed, setActionFailed] = useState(false);
  const [saving, startSaving] = useTransition();
  const { requestStepUp, stepUpModal } = useStepUp(onVerifyPin);

  const columns: TableColumn<ListRow>[] = [
    {
      id: "property",
      header: t("property"),
      cell: (row) => (
        <span className="flex items-center gap-3">
          {row.coverUrl ? (
            <span
              aria-hidden="true"
              style={{
                width: 64,
                height: 48,
                borderRadius: "var(--r-sm)",
                backgroundImage: "url(" + row.coverUrl + ")",
                backgroundPosition: "center",
                backgroundSize: "cover",
                flex: "0 0 auto",
              }}
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-12 w-16 items-center justify-center rounded-lg bg-surface2 text-xs text-muted"
            >
              {t("noPhoto")}
            </span>
          )}
          <span className="grid gap-1">
            <strong>{row.title || t("untitled")}</strong>
            <span className="text-xs text-muted">{row.ref}</span>
          </span>
        </span>
      ),
    },
    { id: "owner", header: t("owner"), cell: (row) => row.owner_name },
    {
      id: "location",
      header: t("location"),
      cell: (row) => row.city || "—",
    },
    {
      id: "price",
      header: t("price"),
      numeric: true,
      cell: (row) => {
        const cents = row.deal === "rent" ? row.rent_cents : row.price_cents;
        return cents === null
          ? "—"
          : new Intl.NumberFormat(locale === "en" ? "en-IE" : "pt-PT", {
              style: "currency",
              currency: "EUR",
              maximumFractionDigits: 0,
            }).format(cents / 100);
      },
    },
    {
      id: "created",
      header: t("submittedAt"),
      cell: (row) => dateLabel(row.created_at, locale),
    },
  ];

  function changePage(nextPage: number) {
    if (nextPage === pageInfo.page) return;
    if (nextPage === 1) {
      window.location.assign(makeHref(status));
      return;
    }
    const isNext = nextPage > pageInfo.page;
    const cursor = isNext ? pageInfo.lastCursor : pageInfo.firstCursor;
    if (!cursor) return;
    window.location.assign(
      makeHref(status, {
        cursor_created_at: cursor.createdAt,
        cursor_id: cursor.id,
        direction: isNext ? "next" : "prev",
        page: String(nextPage),
      }),
    );
  }

  function submitAction(input: { propertyId: string; action: ActionName; reason: string }) {
    startSaving(async () => {
      const result = await onModerate(input);
      if (result.needsStepUp) {
        requestStepUp(() => submitAction(input));
        return;
      }
      if (!result.ok) {
        setActionFailed(true);
        return;
      }
      window.location.reload();
    });
  }

  const nextStatus = selectedProperty?.status;
  const availableActions: ActionName[] =
    nextStatus === "pending_review"
      ? ["approve", "reject"]
      : nextStatus === "active"
        ? ["feature", "reopen"]
        : nextStatus === "featured"
          ? ["unfeature", "reopen"]
          : nextStatus === "rejected"
            ? ["reopen"]
            : [];
  const address = selectedProperty
    ? [
        selectedProperty.address_line,
        [selectedProperty.postal_code, selectedProperty.city].filter(Boolean).join(" "),
        selectedProperty.parish,
        selectedProperty.district,
      ]
        .filter(Boolean)
        .join(", ")
    : "";

  return (
    <>
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold text-text">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
        </header>

        <nav aria-label={t("statusTabs")} className="flex flex-wrap gap-2">
          {(["pending_review", "active", "rejected", "featured"] as const).map((item) => (
            <a
              key={item}
              href={makeHref(item)}
              aria-current={status === item ? "page" : undefined}
              className={
                status === item
                  ? "inline-flex items-center gap-2 rounded-full bg-accent-soft px-4 py-2 text-sm font-medium text-text"
                  : "inline-flex items-center gap-2 rounded-full bg-surface px-4 py-2 text-sm text-muted"
              }
            >
              {t("status." + item)}
              <span className="tabular-nums">{counts[item] ?? 0}</span>
            </a>
          ))}
        </nav>

        <Card padded>
          {loadError ? (
            <EmptyState title={t("loadFailed")} />
          ) : properties.length === 0 ? (
            <EmptyState title={t("emptyTitle." + status)} description={t("emptyDescription")} />
          ) : (
            <>
              <Table
                caption={t("tableCaption")}
                columns={columns}
                rows={properties}
                rowKey={(row) => row.id}
                selectedKey={selectedProperty?.id}
                onRowClick={(row) => window.location.assign(makeHref(status, { id: row.id }))}
              />
              <Pagination
                page={pageInfo.page}
                pageCount={pageInfo.pageCount}
                summary={t("resultsRange", {
                  from: (pageInfo.page - 1) * 25 + 1,
                  to: (pageInfo.page - 1) * 25 + properties.length,
                })}
                labels={{ previous: tp("previous"), next: tp("next"), page: t("pageLabel") }}
                onPageChange={changePage}
              />
            </>
          )}
        </Card>
      </div>

      {selectedProperty ? (
        <Drawer
          open
          title={t("detailTitle")}
          subtitle={selectedProperty.title || selectedProperty.ref}
          closeLabel={t("closeDrawer")}
          onClose={() => window.location.assign(makeHref(status))}
          footerStyle={{ justifyContent: "center", width: "100%", boxSizing: "border-box" }}
          footer={
            <div className="flex w-full flex-wrap justify-center gap-2">
              {availableActions.map((action) => (
                <Button
                  key={action}
                  variant={
                    action === "reject" ? "danger" : action === "reopen" ? "secondary" : "primary"
                  }
                  leadingIcon={
                    action === "approve" ? (
                      <Check size={16} />
                    ) : action === "reject" ? (
                      <X size={16} />
                    ) : action === "reopen" ? (
                      <RotateCcw size={16} />
                    ) : (
                      <Star size={16} />
                    )
                  }
                  onClick={() => {
                    setActionTarget(action);
                    setReason("");
                    setActionFailed(false);
                  }}
                >
                  {t("action." + action)}
                </Button>
              ))}
            </div>
          }
        >
          <section className="grid gap-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted">{selectedProperty.ref}</p>
                <h3 className="mt-1 text-lg font-semibold text-text">
                  {selectedProperty.title || t("untitled")}
                </h3>
              </div>
              <StatusTag tone={statusTone(selectedProperty.status)}>
                {t("status." + selectedProperty.status)}
              </StatusTag>
            </div>
            <p className="text-sm text-muted">{selectedProperty.description}</p>
          </section>

          <section className="mt-6 grid gap-3">
            <h3 className="text-sm font-semibold text-text">{t("photos")}</h3>
            {media.length ? (
              <div className="grid grid-cols-2 gap-3">
                {media.map((item) =>
                  item.signedUrl ? (
                    <a
                      key={item.id}
                      href={item.signedUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={t(item.kind === "floorplan" ? "floorplan" : "photo")}
                      className="block overflow-hidden rounded-xl border border-border"
                    >
                      <span
                        className="block aspect-[4/3] bg-surface2 bg-cover bg-center"
                        style={{ backgroundImage: "url(" + item.signedUrl + ")" }}
                      />
                      <span className="block px-3 py-2 text-xs text-muted">
                        {t(item.kind === "floorplan" ? "floorplan" : "photo")}
                      </span>
                    </a>
                  ) : null,
                )}
              </div>
            ) : (
              <p className="text-sm text-muted">{t("noPhoto")}</p>
            )}
          </section>

          <section className="mt-6 grid gap-3">
            <h3 className="text-sm font-semibold text-text">{t("propertyDetails")}</h3>
            <DetailRow label={t("owner")} value={selectedProperty.owner_name} />
            <DetailRow label={t("deal")} value={t("deal." + selectedProperty.deal)} />
            <DetailRow label={t("type")} value={selectedProperty.property_type || "—"} />
            <DetailRow label={t("typology")} value={selectedProperty.typology} />
            <DetailRow label={t("condition")} value={selectedProperty.condition || "—"} />
            <DetailRow
              label={t("area")}
              value={
                [selectedProperty.gross_area, selectedProperty.net_area]
                  .filter((value) => value !== null)
                  .join(" / ") || "—"
              }
            />
            <DetailRow
              label={t("rooms")}
              value={
                [selectedProperty.bedrooms, selectedProperty.bathrooms]
                  .filter((value) => value !== null)
                  .join(" / ") || "—"
              }
            />
            <DetailRow label={t("address")} value={address || "—"} />
            <DetailRow label={t("coordinates")} value={exactLocation || "—"} />
            <DetailRow label={t("energy")} value={selectedProperty.energy_cert || "—"} />
            <DetailRow
              label={t("price")}
              value={
                selectedProperty.deal === "rent"
                  ? currency(selectedProperty.rent_cents)
                  : currency(selectedProperty.price_cents)
              }
            />
            <DetailRow
              label={t("createdAt")}
              value={dateLabel(selectedProperty.created_at, locale)}
            />
            {selectedProperty.rejection_reason ? (
              <DetailRow label={t("previousReason")} value={selectedProperty.rejection_reason} />
            ) : null}
          </section>

          <section className="mt-6 grid gap-3">
            <h3 className="text-sm font-semibold text-text">{t("documents")}</h3>
            {documents.length ? (
              <ul className="grid gap-2">
                {documents.map((document) => (
                  <li key={document.id}>
                    {document.signedUrl ? (
                      <a
                        href={document.signedUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm text-accent underline"
                      >
                        {document.name}
                      </a>
                    ) : (
                      <span className="text-sm text-muted">{document.name}</span>
                    )}
                    <span className="ml-2 text-xs text-muted">
                      {t("documentKind." + document.kind)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{t("noDocuments")}</p>
            )}
          </section>

          <section className="mt-6 grid gap-3">
            <h3 className="text-sm font-semibold text-text">{t("history")}</h3>
            {history.length ? (
              <ol className="grid gap-3">
                {history.map((item) => (
                  <li key={item.id} className="border-l-2 border-border pl-3">
                    <p className="text-sm font-medium text-text">{t("event." + item.action)}</p>
                    <p className="text-xs text-muted">
                      {t("status." + item.status_from)} → {t("status." + item.status_to)} ·{" "}
                      {item.actor_name}
                    </p>
                    {item.reason ? <p className="mt-1 text-sm text-muted">{item.reason}</p> : null}
                    <time className="text-xs text-muted" dateTime={item.created_at}>
                      {dateLabel(item.created_at, locale)}
                    </time>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">{t("noHistory")}</p>
            )}
          </section>
        </Drawer>
      ) : selectedPropertyError ? (
        <Drawer
          open
          title={t("detailTitle")}
          closeLabel={t("closeDrawer")}
          onClose={() => window.location.assign(makeHref(status))}
        >
          <p className="text-sm text-danger" role="alert">
            {t("detailFailed")}
          </p>
        </Drawer>
      ) : null}

      <Modal
        open={actionTarget !== null}
        onClose={() => setActionTarget(null)}
        size="sm"
        title={actionTarget ? t("confirm." + actionTarget + "Title") : ""}
        closeLabel={tc("close")}
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedProperty || !actionTarget) return;
            submitAction({ propertyId: selectedProperty.id, action: actionTarget, reason });
          }}
        >
          {actionTarget ? (
            <p className="text-sm text-muted">{t("confirm." + actionTarget + "Body")}</p>
          ) : null}
          {actionTarget === "reject" ? (
            <Textarea
              label={t("reason")}
              hint={t("reasonHint")}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              minLength={3}
              maxLength={500}
              required
            />
          ) : null}
          {actionFailed ? (
            <p className="text-sm text-danger" role="alert">
              {t("actionFailed")}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setActionTarget(null)}>
              {tc("cancel")}
            </Button>
            <Button
              type="submit"
              variant={actionTarget === "reject" ? "danger" : "primary"}
              disabled={saving}
            >
              {actionTarget ? t("action." + actionTarget) : tc("confirm")}
            </Button>
          </div>
        </form>
      </Modal>
      {stepUpModal}
    </>
  );

  function currency(cents: number | null) {
    if (cents === null) return "—";
    return new Intl.NumberFormat(locale === "en" ? "en-IE" : "pt-PT", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(cents / 100);
  }
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] gap-4 border-b border-border pb-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="break-words text-text">{value}</span>
    </div>
  );
}
