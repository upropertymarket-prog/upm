"use client";

import { useState, useTransition } from "react";
import { Button, Card, Toggle, useToast } from "@upm/ui";
import {
  ACTIVE_NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
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
      toast(result.error ?? "Preferências guardadas.", result.error ? "error" : "success");
    });
  }

  return (
    <Card padded style={{ display: "grid", gap: "var(--sp-7)" }}>
      <div style={{ display: "grid", gap: "var(--sp-2)" }}>
        <h2 style={{ margin: 0, fontSize: "var(--fs-subtitle-lg)" }}>Notificações</h2>
        <p style={{ margin: 0, color: "var(--muted)" }}>
          Escolha o que quer receber no sino da aplicação e por e-mail.
        </p>
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
            <span style={{ flex: "1 1 240px", minWidth: 0 }}>{NOTIFICATION_TYPE_LABELS[type]}</span>
            {/* Os dois canais empilhados: lado a lado, "Na aplicação" e "Por
                e-mail" liam-se como um par de opções da mesma pergunta em vez
                de dois interruptores independentes. */}
            <span style={{ display: "grid", gap: "var(--sp-3)", justifyItems: "start" }}>
              <Toggle
                label="Na aplicação"
                checked={prefEnabled(draft, type, "inapp")}
                onCheckedChange={(value) => set(type, "inapp", value)}
              />
              <Toggle
                label="Por e-mail"
                checked={prefEnabled(draft, type, "email")}
                onCheckedChange={(value) => set(type, "email", value)}
              />
            </span>
          </li>
        ))}
      </ul>

      <p style={{ margin: 0, color: "var(--muted)" }}>
        Os e-mails entram numa fila e são enviados assim que o serviço de envio estiver ligado — a
        escolha do fornecedor ficou para o fim do projeto (07 §16.1 e §18.4). O sino funciona já.
      </p>

      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button onClick={save} disabled={pending}>
          Guardar preferências
        </Button>
      </div>
    </Card>
  );
}
