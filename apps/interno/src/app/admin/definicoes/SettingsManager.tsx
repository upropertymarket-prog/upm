"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Settings2 } from "lucide-react";
import { Button, Card, EmptyState, Input, Modal, Select, StatusTag, Textarea } from "@upm/ui";
import type { Json } from "@upm/db";
import { useStepUp } from "../../../components/StepUpModal";
import type { VerifyPinAction } from "../../../components/stepUpTypes";
import type { SettingsActionResult } from "./actions";

type Flag = { key: string; value: Json; description: string };
type Setting = { key: string; value: Json; description: string; public: boolean };
type SettingKey =
  | "company_name"
  | "company_tax_id"
  | "company_address"
  | "company_phone"
  | "company_email"
  | "billing_email";
type FlagKey = "launch_mode" | "interno_ip_allowlist";

function scalar(value: Json): string {
  return typeof value === "string" ? value : "";
}

export function SettingsManager({
  flags,
  settings,
  integrations,
  loadError,
  onSaveFlag,
  onSaveSetting,
  onVerifyPin,
}: {
  flags: Flag[];
  settings: Setting[];
  integrations: Record<"stripe" | "supabase" | "maptiler" | "analytics", boolean>;
  loadError: boolean;
  onSaveFlag: (input: unknown) => Promise<SettingsActionResult>;
  onSaveSetting: (input: unknown) => Promise<SettingsActionResult>;
  onVerifyPin: VerifyPinAction;
}) {
  const t = useTranslations("admin.settings");
  const tc = useTranslations("common");
  const [company, setCompany] = useState<Record<string, string>>(() =>
    Object.fromEntries(settings.map((item) => [item.key, scalar(item.value)])),
  );
  const [allowlist, setAllowlist] = useState(() => {
    const value = flags.find((flag) => flag.key === "interno_ip_allowlist")?.value;
    return Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string").join("\n")
      : "";
  });
  const launchMode = scalar(flags.find((flag) => flag.key === "launch_mode")?.value ?? "pre");
  const [pendingMode, setPendingMode] = useState<"pre" | "post" | null>(null);
  const [message, setMessage] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [saving, startSaving] = useTransition();
  const { requestStepUp, stepUpModal } = useStepUp(onVerifyPin);

  function saveFlag(key: FlagKey, value: string | string[]) {
    setSavingKey(key);
    startSaving(async () => {
      const result = await onSaveFlag({ key, value });
      if (result.needsStepUp) {
        requestStepUp(() => saveFlag(key, value));
        return;
      }
      setMessage(!result.ok);
      if (result.ok) window.location.reload();
    });
  }
  function saveCompany(key: SettingKey) {
    const value = company[key] ?? "";
    setSavingKey(key);
    startSaving(async () => {
      const result = await onSaveSetting({ key, value });
      if (result.needsStepUp) {
        requestStepUp(() => saveCompany(key));
        return;
      }
      setMessage(!result.ok);
      if (result.ok) window.location.reload();
    });
  }
  const fields: Array<{ key: SettingKey; label: string; kind?: "email" | "tel" }> = [
    { key: "company_name", label: t("companyName") },
    { key: "company_tax_id", label: t("taxId") },
    { key: "company_address", label: t("address") },
    { key: "company_phone", label: t("phone"), kind: "tel" },
    { key: "company_email", label: t("publicEmail"), kind: "email" },
    { key: "billing_email", label: t("billingEmail"), kind: "email" },
  ];
  const integrationRows: Array<[keyof typeof integrations, string]> = [
    ["stripe", "Stripe"],
    ["supabase", "Supabase"],
    ["maptiler", "MapTiler"],
    ["analytics", "Umami"],
  ];

  return (
    <>
      <div className="flex flex-col gap-6">
        <header>
          <h1 className="text-2xl font-semibold text-text">{t("title")}</h1>
          <p className="mt-1 text-sm text-muted">{t("subtitle")}</p>
        </header>
        {loadError ? <EmptyState icon={<Settings2 size={36} />} title={t("loadFailed")} /> : null}
        <Card padded>
          <section className="grid gap-5">
            <div>
              <h2 className="text-lg font-semibold text-text">{t("flagsTitle")}</h2>
              <p className="mt-1 text-sm text-muted">{t("flagsHint")}</p>
            </div>
            <div className="grid gap-4 rounded-xl border border-border p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div>
                <h3 className="font-medium text-text">{t("launchMode")}</h3>
                <p className="mt-1 text-sm text-muted">{t("launchModeHint")}</p>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <Select
                  label={t("launchMode")}
                  value={launchMode}
                  onChange={(event) => setPendingMode(event.target.value as "pre" | "post")}
                  options={[
                    { value: "pre", label: t("preLaunch") },
                    { value: "post", label: t("postLaunch") },
                  ]}
                />
                <Button
                  disabled={saving || !pendingMode || pendingMode === launchMode}
                  onClick={() => pendingMode && saveFlag("launch_mode", pendingMode)}
                >
                  {t("saveLaunchMode")}
                </Button>
              </div>
            </div>
            <div className="grid gap-3 rounded-xl border border-border p-4">
              <div>
                <h3 className="font-medium text-text">{t("ipAllowlist")}</h3>
                <p className="mt-1 text-sm text-muted">{t("ipAllowlistHint")}</p>
              </div>
              <Textarea
                label={t("ipAllowlist")}
                value={allowlist}
                onChange={(event) => setAllowlist(event.target.value)}
                hint={t("ipAllowlistFormat")}
                maxLength={4096}
              />
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  disabled={saving}
                  onClick={() =>
                    saveFlag(
                      "interno_ip_allowlist",
                      allowlist
                        .split(/\r?\n/)
                        .map((item) => item.trim())
                        .filter(Boolean),
                    )
                  }
                >
                  {t("saveAllowlist")}
                </Button>
              </div>
            </div>
          </section>
        </Card>
        <Card padded>
          <section className="grid gap-5">
            <div>
              <h2 className="text-lg font-semibold text-text">{t("companyTitle")}</h2>
              <p className="mt-1 text-sm text-muted">{t("companyHint")}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {fields.map(({ key, label, kind }) => (
                <div key={key} className="grid gap-2 rounded-xl border border-border p-4">
                  <Input
                    type={kind ?? "text"}
                    label={label}
                    value={company[key] ?? ""}
                    maxLength={500}
                    onChange={(event) =>
                      setCompany((current) => ({ ...current, [key]: event.target.value }))
                    }
                  />
                  <div className="flex justify-end">
                    <Button
                      variant="secondary"
                      disabled={
                        saving ||
                        (company[key] ?? "") ===
                          scalar(settings.find((item) => item.key === key)?.value ?? "")
                      }
                      onClick={() => saveCompany(key)}
                    >
                      {tc("saveChanges")}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </Card>
        <Card padded>
          <section className="grid gap-5">
            <div>
              <h2 className="text-lg font-semibold text-text">{t("integrationsTitle")}</h2>
              <p className="mt-1 text-sm text-muted">{t("integrationsHint")}</p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {integrationRows.map(([key, label]) => (
                <li
                  key={key}
                  className="flex items-center justify-between rounded-xl border border-border p-4"
                >
                  <span>{label}</span>
                  <StatusTag tone={integrations[key] ? "active" : "pending"}>
                    {integrations[key] ? t("configured") : t("notConfigured")}
                  </StatusTag>
                </li>
              ))}
            </ul>
          </section>
        </Card>
        {message ? (
          <p className="text-sm text-danger" role="alert">
            {t("saveFailed")}
            {savingKey ? " · " + savingKey : ""}
          </p>
        ) : null}
      </div>
      <Modal
        open={pendingMode !== null && pendingMode !== launchMode}
        onClose={() => setPendingMode(null)}
        size="sm"
        title={t("launchConfirmTitle")}
        closeLabel={tc("close")}
      >
        <div className="grid gap-4">
          <p className="text-sm text-muted">
            {pendingMode === "post" ? t("launchConfirmPost") : t("launchConfirmPre")}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setPendingMode(null)}>
              {tc("cancel")}
            </Button>
            <Button
              disabled={saving}
              onClick={() => pendingMode && saveFlag("launch_mode", pendingMode)}
            >
              {t("confirmLaunchMode")}
            </Button>
          </div>
        </div>
      </Modal>
      {stepUpModal}
    </>
  );
}
