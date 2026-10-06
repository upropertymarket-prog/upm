"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Download, Trash2 } from "lucide-react";
import { Button, Card, Input, Modal, useToast } from "@upm/ui";

/**
 * Zona de perigo — `/definicoes` (Fase 9, P9-06)
 * =========================================================================
 * Fecha a metade de D25 que faltava. 04 §8.3 dá a esta página cinco secções e
 * esta é a quinta; 02 §7.3 exige as duas operações que ela contém — exportar
 * os dados e eliminar a conta.
 *
 * O que este ecrã **não** faz é decidir o que a eliminação conserva. Isso é de
 * `delete_own_account()`, em SQL: perfil anonimizado, histórico de subscrições,
 * faturas e aceitações conservados. O texto aqui diz o que vai acontecer, com as
 * palavras certas, porque esconder a retenção num parágrafo vago seria pior do
 * que não a ter.
 */
export type DangerZoneProps = {
  onExport: () => Promise<{ json?: string; error?: string }>;
  onDelete: (
    prev: { ok?: boolean; error?: string },
    formData: FormData,
  ) => Promise<{ ok?: boolean; error?: string }>;
  /** Para onde se vai depois de a conta deixar de existir. */
  afterDeleteUrl: string;
};

export function DangerZone({ onExport, onDelete, afterDeleteUrl }: DangerZoneProps) {
  const t = useTranslations("settings.danger");
  const tc = useTranslations("common");
  const { toast } = useToast();
  const [exporting, startExport] = useTransition();
  const [open, setOpen] = useState(false);
  const [state, remove, removing] = useActionState(onDelete, {});

  if (state.ok) {
    // A sessão já terminou do lado do servidor; o que falta é sair da app.
    window.location.assign(afterDeleteUrl);
  }

  function exportData() {
    startExport(async () => {
      const result = await onExport();
      if (result.error || !result.json) {
        toast(result.error ?? t("exportFailed"), "error");
        return;
      }
      // O ficheiro nasce e morre no browser: nada vai para o Storage, por isso
      // não fica um objeto com dados pessoais esquecido num bucket (08 §6.3).
      const url = URL.createObjectURL(new Blob([result.json], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = `uproperty-dados-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast(t("exportDone"), "success");
    });
  }

  return (
    <Card
      padded
      style={{
        display: "grid",
        gap: "var(--sp-5)",
        borderColor: "var(--danger)",
      }}
    >
      <div style={{ display: "grid", gap: "var(--sp-2)" }}>
        <strong style={{ fontSize: "var(--fs-body-lg)" }}>{t("title")}</strong>
        <span style={{ fontSize: "var(--fs-body)", color: "var(--muted)", lineHeight: 1.5 }}>
          {t("subtitle")}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "var(--sp-4)",
          alignItems: "center",
        }}
      >
        <Button
          variant="secondary"
          onClick={exportData}
          disabled={exporting}
          leadingIcon={<Download size={16} />}
        >
          {exporting ? t("exporting") : t("export")}
        </Button>
        <Button
          variant="secondary"
          onClick={() => setOpen(true)}
          style={{ borderColor: "var(--danger)", color: "var(--danger)" }}
          leadingIcon={<Trash2 size={16} />}
        >
          {t("delete")}
        </Button>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={t("modalTitle")}>
        <form action={remove} style={{ display: "grid", gap: "var(--sp-5)" }}>
          <p style={{ margin: 0, fontSize: "var(--fs-body)", lineHeight: 1.5 }}>{t("modalBody")}</p>

          {/* O que é conservado, dito por extenso. P9-06 separa as camadas e
              esta lista é a mesma separação em linguagem de pessoa. */}
          <ul
            style={{
              margin: 0,
              paddingInlineStart: "var(--sp-6)",
              display: "grid",
              gap: "var(--sp-2)",
              fontSize: "var(--fs-body)",
              lineHeight: 1.5,
            }}
          >
            <li>{t("keepsSubscriptions")}</li>
            <li>{t("keepsInvoices")}</li>
            <li>{t("keepsTerms")}</li>
            <li>{t("anonymizes")}</li>
            <li>{t("archivesListings")}</li>
          </ul>

          <p style={{ margin: 0, fontSize: "var(--fs-caption)", color: "var(--muted)" }}>
            {t("legalNote")}
          </p>

          <label style={{ display: "grid", gap: "var(--sp-2)" }}>
            <span style={{ fontSize: "var(--fs-body)", fontWeight: 600 }}>{t("reasonLabel")}</span>
            <textarea
              name="reason"
              rows={2}
              maxLength={1000}
              className="upm-input"
              style={{ resize: "vertical", padding: "var(--sp-4)", fontSize: "var(--fs-body)" }}
            />
          </label>

          <Input name="confirm" label={t("confirmLabel")} hint={t("confirmHint")} required />

          {state.error ? (
            <p role="alert" style={{ margin: 0, color: "var(--danger)" }}>
              {state.error}
            </p>
          ) : null}

          <div style={{ display: "flex", gap: "var(--sp-4)", justifyContent: "flex-end" }}>
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              {tc("cancel")}
            </Button>
            <Button
              type="submit"
              disabled={removing}
              style={{ background: "var(--danger)", borderColor: "var(--danger)" }}
            >
              {removing ? t("deleting") : t("confirmDelete")}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
