"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button, Card, Toggle, useToast } from "@upm/ui";
import {
  ACTIVE_NOTIFICATION_TYPES,
  prefEnabled,
  type NotificationPrefs,
  type NotificationType,
} from "@upm/db/interaction";

export type NotificationPrefsFormProps = {
  prefs: NotificationPrefs;
  onSave: (prefs: NotificationPrefs) => Promise<{ error?: string }>;
};

/**
 * Definições › Notificações (P5-04) — 02 §10 "Preferências por tipo"
 * =========================================================================
 * Dois canais por tipo: sino e e-mail. Só aparecem os tipos que já têm quem os
 * emita (`ACTIVE_NOTIFICATION_TYPES`) — desligar o aviso de um documento
 * partilhado antes de existirem documentos seria um interruptor a fingir.
 *
 * Ausente = ligado, a mesma regra que a função `notify()` aplica no servidor:
 * as preferências são opt-out, senão uma conta nova não receberia nada.
 *
 * `Toggle` e não `Checkbox` porque a mudança é a definição em si; o Guardar
 * confirma, não decide (regra do design system para os dois componentes).
 */
export function NotificationPrefsForm({ prefs, onSave }: NotificationPrefsFormProps) {
  const t = useTranslations("notifications.prefs");
  const tType = useTranslations("notifications.type");
  const [draft, setDraft] = useState<NotificationPrefs>(prefs);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function set(type: NotificationType, channel: "inapp" | "email", value: boolean) {
    setDraft((current) => ({
      ...current,
      [type]: {
        inapp: channel === "inapp" ? value : prefEnabled(current, type, "inapp"),
        email: channel === "email" ? value : prefEnabled(current, type, "email"),
      },
    }));
  }

  function save() {
    startTransition(async () => {
      const result = await onSave(draft);
      toast(result.error ?? t("saved"), result.error ? "error" : "success");
    });
  }

  return (
    <Card padded style={{ display: "grid", gap: "var(--sp-7)" }}>
      <div style={{ display: "grid", gap: "var(--sp-2)" }}>
        <h2 style={{ margin: 0, fontSize: "var(--fs-subtitle-lg)" }}>{t("title")}</h2>
        <p style={{ margin: 0, color: "var(--muted)" }}>{t("subtitle")}</p>
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid" }}>
        {ACTIVE_NOTIFICATION_TYPES.map((type) => (
          <li
            key={type}
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "var(--sp-7)",
              padding: "var(--sp-3) 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span style={{ flex: "1 1 240px", minWidth: 0 }}>{tType(type)}</span>
            {/* Os dois canais lado a lado, com folga grande entre eles: a
                separação é que os mantém a ler-se como dois interruptores
                independentes e não como um par de opções da mesma pergunta. */}
            <span style={{ display: "flex", flexDirection: "row", gap: "48px" }}>
              <Toggle
                size="md"
                label={t("inapp")}
                checked={prefEnabled(draft, type, "inapp")}
                onCheckedChange={(value) => set(type, "inapp", value)}
              />
              <Toggle
                size="md"
                label={t("email")}
                checked={prefEnabled(draft, type, "email")}
                onCheckedChange={(value) => set(type, "email", value)}
              />
            </span>
          </li>
        ))}
      </ul>

      <p style={{ margin: 0, color: "var(--muted)" }}>{t("queueNote")}</p>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button onClick={save} disabled={pending}>
          {t("save")}
        </Button>
      </div>
    </Card>
  );
}
