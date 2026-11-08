"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import {
  Download,
  KeyRound,
  Mail,
  ShieldCheck,
  Smartphone,
  Trash2,
  UserRound,
  UserRoundCheck,
} from "lucide-react";
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
  type StatusTone,
  type TableColumn,
} from "@upm/ui";

import { useStepUp } from "../../../components/StepUpModal";
import type { VerifyPinAction } from "../../../components/stepUpTypes";
import type {
  ProfileStatusActionResult,
  StaffAccessActionResult,
  StaffExitActionResult,
} from "./actions";

/** As contas de equipa — as únicas com "Acesso" no painel (8 nov 2026). */
const STAFF_ROLES = new Set(["admin", "support", "marketing"]);
type AccessAction = "password" | "twoFactor";
type ExitProblem = "blockers" | "needsExport" | "notSuspended" | "failed";

export type UserDirectoryRow = {
  id: string;
  full_name: string;
  email: string;
  // `marketing` entrou com P10-07, quando a área nasceu (07 §24.6). Este tipo
  // é escrito à mão enquanto D64 não permitir regenerar os gerados — e foi
  // exatamente assim que `status` divergiu na Fase 9, com o quarto estado.
  role: "buyer" | "owner" | "admin" | "support" | "marketing";
  // `deleted` entrou com P9-06: a conta eliminada não some de `profiles` —
  // esvazia-se, para o histórico de subscrições e de aceitações não ficar
  // órfão. Este tipo era escrito à mão com três estados e só divergiu quando a
  // regeneração dos tipos trouxe o quarto.
  status: "pending" | "active" | "suspended" | "deleted";
  plan_name: string | null;
  plan_slug: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  created_at: string;
};

export type UserDetail = UserDirectoryRow & {
  updated_at: string;
  current_period_end: string | null;
};

export type UserFilters = {
  search: string;
  role: string;
  status: string;
  planId: string;
};

export type UserCursor = {
  createdAt: string;
  id: string;
};

export type UserPageInfo = {
  page: number;
  pageCount: number;
  hasNext: boolean;
  hasPrevious: boolean;
  firstCursor: UserCursor | null;
  lastCursor: UserCursor | null;
};

type RoleLabelKey = "adminRole" | "buyer" | "owner" | "support" | "marketing";
const PAGE_SIZE = 25;

function statusTone(status: UserDirectoryRow["status"]): StatusTone {
  if (status === "active") return "active";
  if (status === "pending") return "pending";
  // Eliminada não é sancionada: o tom neutro distingue-a da suspensa, que é uma
  // decisão nossa sobre uma conta viva.
  if (status === "deleted") return "draft";
  return "rejected";
}

const PLAN_TONE: Record<string, StatusTone> = {
  gratuito: "draft",
  "gratuito-buyer": "draft",
  "essential-owner": "primary",
  "smarter-owner": "dealSale",
  "smarter-buyer": "dealSale",
  "premium-owner": "dealRent",
  "premium-buyer": "dealRent",
};

function roleLabel(role: UserDirectoryRow["role"], t: (key: RoleLabelKey) => string) {
  return t(role === "admin" ? "adminRole" : role);
}

function dateLabel(value: string | null, locale: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "pt-PT", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function makeHref(filters: UserFilters, extra: Record<string, string | null> = {}) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.role) params.set("role", filters.role);
  if (filters.status) params.set("status", filters.status);
  if (filters.planId) params.set("plan", filters.planId);
  for (const [key, value] of Object.entries(extra)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const query = params.toString();
  return query ? "/admin/utilizadores?" + query : "/admin/utilizadores";
}

function ProfileAccessLogger({
  profileId,
  onOpen,
}: {
  profileId: string;
  onOpen: (profileId: string) => Promise<void>;
}) {
  useEffect(() => {
    void onOpen(profileId);
  }, [onOpen, profileId]);
  return null;
}

export function UsersManager({
  users,
  plans,
  filters,
  pageInfo,
  selectedProfile,
  selectedProfileError,
  loadError,
  locale,
  currentAdminId,
  onChangeStatus,
  onLogAccess,
  onVerifyPin,
  onResetPassword,
  onResetTwoFactor,
  onExportRecord,
  onDeleteAccount,
}: {
  users: UserDirectoryRow[];
  plans: Array<{ id: string; name: string }>;
  filters: UserFilters;
  pageInfo: UserPageInfo;
  selectedProfile: UserDetail | null;
  selectedProfileError: boolean;
  loadError: boolean;
  locale: string;
  currentAdminId: string | null;
  onChangeStatus: (input: {
    profileId: string;
    status: "active" | "suspended";
    reason: string;
  }) => Promise<ProfileStatusActionResult>;
  onLogAccess: (profileId: string) => Promise<void>;
  onVerifyPin: VerifyPinAction;
  /** Envia à pessoa o link para definir uma palavra-passe nova. */
  onResetPassword: (input: { profileId: string }) => Promise<StaffAccessActionResult>;
  /** Remove a 2FA de quem perdeu o telemóvel. */
  onResetTwoFactor: (input: { profileId: string }) => Promise<StaffAccessActionResult>;
  /** O registo da pessoa, em CSV, para guardar fora do sistema (saída da equipa). */
  onExportRecord: (input: { profileId: string }) => Promise<StaffExitActionResult>;
  /** Elimina a conta de quem saiu da equipa, depois do registo descarregado. */
  onDeleteAccount: (input: { profileId: string }) => Promise<StaffExitActionResult>;
}) {
  const t = useTranslations("admin.users");
  const tc = useTranslations("common");
  const tp = useTranslations("pagination");
  const [statusTarget, setStatusTarget] = useState<"active" | "suspended" | null>(null);
  const [reason, setReason] = useState("");
  const [actionFailed, setActionFailed] = useState(false);
  const [saving, startSaving] = useTransition();
  const { requestStepUp, stepUpModal } = useStepUp(onVerifyPin);
  const [accessTarget, setAccessTarget] = useState<AccessAction | null>(null);
  const [accessDone, setAccessDone] = useState<AccessAction | null>(null);
  const [accessFailed, setAccessFailed] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitExported, setExitExported] = useState(false);
  const [exitProblem, setExitProblem] = useState<ExitProblem | null>(null);
  const [exitBlockers, setExitBlockers] = useState({ openLeads: 0, mailboxes: 0 });

  /** Lê o resultado da saída; `true` quando correu bem. */
  function exitResult(result: StaffExitActionResult, retry: () => void): boolean {
    if (result.needsStepUp) {
      requestStepUp(retry);
      return false;
    }
    if (result.blockers) {
      setExitBlockers(result.blockers);
      setExitProblem("blockers");
      return false;
    }
    if (result.needsExport) {
      setExitExported(false);
      setExitProblem("needsExport");
      return false;
    }
    if (result.notSuspended) {
      setExitProblem("notSuspended");
      return false;
    }
    if (!result.ok) {
      setExitProblem("failed");
      return false;
    }
    setExitProblem(null);
    return true;
  }

  function exportRecord(profileId: string, email: string) {
    startSaving(async () => {
      const result = await onExportRecord({ profileId });
      if (!exitResult(result, () => exportRecord(profileId, email)) || !result.csv) return;
      const blob = new Blob(["﻿", result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const carimbo = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "h");
      link.download = `registo-equipa_${email.split("@")[0]}_${carimbo}.csv`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setExitExported(true);
    });
  }

  function deleteAccount(profileId: string) {
    startSaving(async () => {
      const result = await onDeleteAccount({ profileId });
      if (!exitResult(result, () => deleteAccount(profileId))) return;
      // O perfil já não existe: fecha-se o painel.
      window.location.assign(makeHref(filters));
    });
  }

  function applyAccess(action: AccessAction, profileId: string) {
    startSaving(async () => {
      const run = action === "password" ? onResetPassword : onResetTwoFactor;
      const result = await run({ profileId });
      if (result.needsStepUp) {
        requestStepUp(() => applyAccess(action, profileId));
        return;
      }
      if (!result.ok) {
        setAccessFailed(true);
        return;
      }
      setAccessTarget(null);
      setAccessDone(action);
    });
  }

  function applyStatus(input: {
    profileId: string;
    status: "active" | "suspended";
    reason: string;
  }) {
    startSaving(async () => {
      const result = await onChangeStatus(input);
      if (result.needsStepUp) {
        requestStepUp(() => applyStatus(input));
        return;
      }
      if (!result.ok) {
        setActionFailed(true);
        return;
      }
      window.location.reload();
    });
  }

  const columns: TableColumn<UserDirectoryRow>[] = [
    {
      id: "identity",
      header: t("name"),
      cell: (row) => (
        <span style={{ display: "grid", gap: 3 }}>
          <strong>{row.full_name || row.email}</strong>
          <span style={{ color: "var(--muted)", fontSize: 13 }}>{row.email}</span>
        </span>
      ),
    },
    { id: "role", header: t("role"), cell: (row) => roleLabel(row.role, t) },
    {
      id: "plan",
      header: t("plan"),
      cell: (row) =>
        row.plan_name ? (
          <StatusTag tone={PLAN_TONE[row.plan_slug ?? ""] ?? "draft"}>{row.plan_name}</StatusTag>
        ) : (
          t("noPlan")
        ),
    },
    {
      id: "status",
      header: t("status"),
      cell: (row) => <StatusTag tone={statusTone(row.status)}>{t(row.status)}</StatusTag>,
    },
    { id: "created", header: t("createdAt"), cell: (row) => dateLabel(row.created_at, locale) },
  ];

  function changePage(nextPage: number) {
    if (nextPage === pageInfo.page) return;
    if (nextPage === 1) {
      window.location.assign(makeHref(filters));
      return;
    }
    const isNext = nextPage > pageInfo.page;
    const cursor = isNext ? pageInfo.lastCursor : pageInfo.firstCursor;
    if (!cursor) return;
    window.location.assign(
      makeHref(filters, {
        cursor_created_at: cursor.createdAt,
        cursor_id: cursor.id,
        direction: isNext ? "next" : "prev",
        page: String(nextPage),
      }),
    );
  }

  const statusAction = selectedProfile?.status === "suspended" ? "active" : "suspended";
  const dialogTitle = statusTarget === "active" ? t("reactivateTitle") : t("suspendTitle");

  return (
    <>
      <div className="flex flex-col gap-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-text">{t("title")}</h1>
            <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
          </div>
        </header>

        <Card padded>
          <form
            action="/admin/utilizadores"
            method="get"
            className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.3fr_1fr_1fr_1fr_auto]"
          >
            <Input
              name="search"
              label={t("search")}
              placeholder={t("searchHint")}
              defaultValue={filters.search}
            />
            <Select
              name="role"
              label={t("roleFilter")}
              defaultValue={filters.role}
              placeholder={t("allRoles")}
              options={[
                { value: "buyer", label: t("buyer") },
                { value: "owner", label: t("owner") },
                { value: "admin", label: t("adminRole") },
                { value: "support", label: t("support") },
                { value: "marketing", label: t("marketing") },
              ]}
            />
            <Select
              name="status"
              label={t("statusFilter")}
              defaultValue={filters.status}
              placeholder={t("allStatuses")}
              options={[
                { value: "active", label: t("active") },
                { value: "pending", label: t("pending") },
                { value: "suspended", label: t("suspended") },
              ]}
            />
            <Select
              name="plan"
              label={t("planFilter")}
              defaultValue={filters.planId}
              placeholder={t("allPlans")}
              options={plans.map((plan) => ({ value: plan.id, label: plan.name }))}
            />
            <div className="flex items-end justify-end sm:col-span-2 xl:col-span-1">
              <Button type="submit">{t("applyFilters")}</Button>
            </div>
          </form>
        </Card>

        <Card padded>
          {loadError ? (
            <EmptyState icon={<UserRound size={36} />} title={t("loadFailed")} />
          ) : users.length === 0 ? (
            <EmptyState
              icon={<UserRound size={36} />}
              title={
                filters.search || filters.role || filters.status || filters.planId
                  ? t("noResultsTitle")
                  : t("emptyTitle")
              }
              description={
                filters.search || filters.role || filters.status || filters.planId
                  ? t("noResultsDescription")
                  : t("emptyDescription")
              }
            />
          ) : (
            <>
              <Table
                caption={t("tableCaption")}
                columns={columns}
                rows={users}
                rowKey={(row) => row.id}
                selectedKey={selectedProfile?.id}
                onRowClick={(row) => window.location.assign(makeHref(filters, { id: row.id }))}
              />
              <Pagination
                page={pageInfo.page}
                pageCount={pageInfo.pageCount}
                summary={t("resultsRange", {
                  from: (pageInfo.page - 1) * PAGE_SIZE + 1,
                  to: (pageInfo.page - 1) * PAGE_SIZE + users.length,
                })}
                labels={{ previous: tp("previous"), next: tp("next"), page: t("pageLabel") }}
                onPageChange={changePage}
              />
            </>
          )}
        </Card>
      </div>

      {selectedProfile ? (
        <Drawer
          open
          title={t("drawerTitle")}
          subtitle={selectedProfile.full_name || selectedProfile.email}
          closeLabel={t("closeDrawer")}
          footerStyle={{ justifyContent: "center" }}
          onClose={() => window.location.assign(makeHref(filters))}
          footer={
            selectedProfile.status === "active" || selectedProfile.status === "suspended" ? (
              <Button
                variant={statusAction === "suspended" ? "danger" : "primary"}
                leadingIcon={
                  statusAction === "suspended" ? (
                    <ShieldCheck size={16} />
                  ) : (
                    <UserRoundCheck size={16} />
                  )
                }
                disabled={selectedProfile.id === currentAdminId && statusAction === "suspended"}
                onClick={() => {
                  setStatusTarget(statusAction);
                  setReason("");
                  setActionFailed(false);
                }}
              >
                {statusAction === "suspended" ? t("suspend") : t("reactivate")}
              </Button>
            ) : null
          }
        >
          <ProfileAccessLogger profileId={selectedProfile.id} onOpen={onLogAccess} />
          <section className="grid gap-3">
            <h3 className="text-sm font-semibold text-text">{t("identity")}</h3>
            <DetailRow label={t("name")} value={selectedProfile.full_name || "—"} />
            <DetailRow label={t("email")} value={selectedProfile.email} />
            <DetailRow label={t("role")} value={roleLabel(selectedProfile.role, t)} />
            <DetailRow
              label={t("status")}
              value={
                <StatusTag tone={statusTone(selectedProfile.status)}>
                  {t(selectedProfile.status)}
                </StatusTag>
              }
            />
          </section>

          <section className="mt-6 grid gap-3">
            <h3 className="text-sm font-semibold text-text">{t("accountDetails")}</h3>
            <DetailRow
              label={t("plan")}
              value={
                selectedProfile.plan_name ? (
                  <StatusTag tone={PLAN_TONE[selectedProfile.plan_slug ?? ""] ?? "draft"}>
                    {selectedProfile.plan_name}
                  </StatusTag>
                ) : (
                  t("noPlan")
                )
              }
            />
            <DetailRow
              label={t("subscription")}
              value={
                selectedProfile.subscription_status
                  ? t(
                      selectedProfile.subscription_status === "trialing"
                        ? "trialing"
                        : selectedProfile.subscription_status === "past_due"
                          ? "pastDue"
                          : "active",
                    )
                  : t("noSubscription")
              }
            />
            <DetailRow
              label={t("trialEndsAt")}
              value={dateLabel(selectedProfile.trial_ends_at, locale)}
            />
            <DetailRow
              label={t("periodEndsAt")}
              value={dateLabel(selectedProfile.current_period_end, locale)}
            />
            <DetailRow
              label={t("createdAt")}
              value={dateLabel(selectedProfile.created_at, locale)}
            />
            <DetailRow
              label={t("updatedAt")}
              value={dateLabel(selectedProfile.updated_at, locale)}
            />
          </section>

          {STAFF_ROLES.has(selectedProfile.role) && selectedProfile.id !== currentAdminId ? (
            <section className="mt-6 grid gap-2">
              <h3 className="text-sm font-semibold text-text">{t("access")}</h3>
              <p className="text-xs text-muted">{t("accessHint")}</p>
              <Button
                variant="secondary"
                leadingIcon={<KeyRound size={16} />}
                onClick={() => {
                  setAccessTarget("password");
                  setAccessFailed(false);
                  setAccessDone(null);
                }}
              >
                {t("resetPassword")}
              </Button>
              <Button
                variant="secondary"
                leadingIcon={<Smartphone size={16} />}
                onClick={() => {
                  setAccessTarget("twoFactor");
                  setAccessFailed(false);
                  setAccessDone(null);
                }}
              >
                {t("resetTwoFactor")}
              </Button>
              {accessDone ? (
                <p className="text-sm text-ok" role="status">
                  {accessDone === "password" ? t("resetPasswordDone") : t("resetTwoFactorDone")}
                </p>
              ) : null}
            </section>
          ) : null}

          {STAFF_ROLES.has(selectedProfile.role) &&
          selectedProfile.id !== currentAdminId &&
          selectedProfile.status === "suspended" ? (
            <section className="mt-6 grid gap-2">
              <h3 className="text-sm font-semibold text-text">{t("exit")}</h3>
              <p className="text-xs text-muted">{t("exitHint")}</p>
              <Button
                variant="danger"
                leadingIcon={<Trash2 size={16} />}
                onClick={() => {
                  setExitOpen(true);
                  setExitExported(false);
                  setExitProblem(null);
                }}
              >
                {t("deleteAccount")}
              </Button>
            </section>
          ) : null}

          <section className="mt-6 grid gap-2">
            <Button variant="secondary" disabled leadingIcon={<Mail size={16} />}>
              {t("sendEmail")}
            </Button>
            <p className="text-xs text-muted">{t("emailUnavailable")}</p>
          </section>
        </Drawer>
      ) : selectedProfileError ? (
        <Drawer
          open
          title={t("drawerTitle")}
          closeLabel={t("closeDrawer")}
          onClose={() => window.location.assign(makeHref(filters))}
        >
          <p className="text-sm text-danger" role="alert">
            {t("detailFailed")}
          </p>
        </Drawer>
      ) : null}

      <Modal
        open={statusTarget !== null}
        onClose={() => setStatusTarget(null)}
        size="sm"
        title={dialogTitle}
        icon={<ShieldCheck size={17} />}
        closeLabel={tc("close")}
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedProfile || !statusTarget) return;
            applyStatus({ profileId: selectedProfile.id, status: statusTarget, reason });
          }}
        >
          <p className="text-sm text-muted">
            {statusTarget === "active" ? t("reactivateBody") : t("suspendBody")}
          </p>
          <Textarea
            label={t("reason")}
            hint={t("reasonHint")}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            minLength={3}
            maxLength={500}
            required
          />
          {actionFailed ? (
            <p className="text-sm text-danger" role="alert">
              {t("changeFailed")}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setStatusTarget(null)}>
              {tc("cancel")}
            </Button>
            <Button
              type="submit"
              variant={statusTarget === "suspended" ? "danger" : "primary"}
              disabled={saving}
            >
              {statusTarget === "suspended" ? t("confirmSuspend") : t("confirmReactivate")}
            </Button>
          </div>
        </form>
      </Modal>
      <Modal
        open={accessTarget !== null}
        onClose={() => setAccessTarget(null)}
        size="sm"
        title={accessTarget === "twoFactor" ? t("resetTwoFactor") : t("resetPassword")}
        icon={accessTarget === "twoFactor" ? <Smartphone size={17} /> : <KeyRound size={17} />}
        closeLabel={tc("close")}
      >
        <div className="grid gap-4">
          <p className="text-sm text-muted">
            {accessTarget === "twoFactor" ? t("resetTwoFactorBody") : t("resetPasswordBody")}
          </p>
          {accessFailed ? (
            <p className="text-sm text-danger" role="alert">
              {t("accessFailed")}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setAccessTarget(null)}>
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              disabled={saving}
              onClick={() => {
                if (selectedProfile && accessTarget) applyAccess(accessTarget, selectedProfile.id);
              }}
            >
              {accessTarget === "twoFactor"
                ? t("confirmResetTwoFactor")
                : t("confirmResetPassword")}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        size="sm"
        title={t("deleteAccount")}
        icon={<Trash2 size={17} />}
        closeLabel={tc("close")}
      >
        <div className="grid gap-4">
          <p className="text-sm text-muted">{t("deleteAccountBody")}</p>
          <Button
            type="button"
            variant="secondary"
            leadingIcon={<Download size={16} />}
            disabled={saving}
            onClick={() => {
              if (selectedProfile) exportRecord(selectedProfile.id, selectedProfile.email);
            }}
          >
            {exitExported ? t("exportRecordAgain") : t("exportRecord")}
          </Button>
          {exitExported ? (
            <p className="text-sm text-ok" role="status">
              {t("exportRecordDone")}
            </p>
          ) : null}
          {exitProblem ? (
            <p className="text-sm text-danger" role="alert">
              {exitProblem === "blockers"
                ? t("exitBlockers", exitBlockers)
                : exitProblem === "needsExport"
                  ? t("exitNeedsExport")
                  : exitProblem === "notSuspended"
                    ? t("exitNotSuspended")
                    : t("accessFailed")}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setExitOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              variant="danger"
              disabled={saving || !exitExported}
              onClick={() => {
                if (selectedProfile) deleteAccount(selectedProfile.id);
              }}
            >
              {t("confirmDeleteAccount")}
            </Button>
          </div>
        </div>
      </Modal>
      {stepUpModal}
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-4 border-b border-border pb-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="break-words text-text">{value}</span>
    </div>
  );
}
