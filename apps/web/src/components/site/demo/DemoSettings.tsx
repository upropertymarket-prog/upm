"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Trash2 } from "lucide-react";
import { Button, Card, Toggle } from "@upm/ui";
import { DEMO_BUYER_PREFS, DEMO_OWNER_PREFS } from "@upm/ui/demo-data";

import type { DemoRole } from "./format";

/**
 * Definições da demonstração — 04 §8.3 · P5-04 · P9-06
 * =========================================================================
 * As três secções que o ecrã verdadeiro tem hoje: Notificações, Aparência e
 * Zona de perigo. Perfil e Preferências de procura continuam a não existir
 * (D25), e aqui também não aparecem — uma caixa vazia na demonstração promete
 * o que o produto não dá.
 *
 * **Os interruptores mexem**, porque é o que um interruptor faz, e o estado
 * vive neste componente: nada é guardado, nada sai daqui.
 *
 * O "Aparência" mostra-se e não funciona, e é a única inércia deliberada do
 * ecrã: a caixa da demonstração tem `data-theme="light"` fixo por decisão de
 * 07 §7 — o que se está a mostrar é o produto, não mais uma superfície do site
 * —, por isso um alternador a sério aqui ou não fazia nada, ou mudava o tema
 * do site inteiro a partir de dentro de uma demonstração.
 */
export function DemoSettings({ role }: { role: DemoRole }) {
  const t = useTranslations("settings");
  const tPrefs = useTranslations("notifications.prefs");
  const tType = useTranslations("notifications.type");
  const tTheme = useTranslations("theme");
  const [prefs, setPrefs] = useState(role === "owner" ? DEMO_OWNER_PREFS : DEMO_BUYER_PREFS);

  function toggle(id: string, channel: "inapp" | "email") {
    setPrefs((current) =>
      current.map((pref) => (pref.id === id ? { ...pref, [channel]: !pref[channel] } : pref)),
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--sp-7)" }}>
      <Card padded style={{ display: "grid", gap: "var(--sp-6)" }}>
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          <h2 style={{ margin: 0, fontSize: "var(--fs-subtitle)" }}>{tPrefs("title")}</h2>
          <p style={{ margin: 0, color: "var(--muted)" }}>{tPrefs("subtitle")}</p>
        </div>

        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid" }}>
          {prefs.map((pref) => (
            <li
              key={pref.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--sp-5)",
                flexWrap: "wrap",
                padding: "var(--sp-4) 0",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ flex: 1, minWidth: "min(100%, 180px)" }}>{tType(pref.id)}</span>
              <Toggle
                size="md"
                label={`${tType(pref.id)} · ${tPrefs("inapp")}`}
                labelHidden
                checked={pref.inapp}
                onCheckedChange={() => toggle(pref.id, "inapp")}
              />
              <span style={{ color: "var(--muted)", fontSize: "var(--fs-label)", width: 92 }}>
                {tPrefs("inapp")}
              </span>
              <Toggle
                size="md"
                label={`${tType(pref.id)} · ${tPrefs("email")}`}
                labelHidden
                checked={pref.email}
                onCheckedChange={() => toggle(pref.id, "email")}
              />
              <span style={{ color: "var(--muted)", fontSize: "var(--fs-label)", width: 92 }}>
                {tPrefs("email")}
              </span>
            </li>
          ))}
        </ul>

        <div>
          <Button variant="secondary">{tPrefs("save")}</Button>
        </div>
      </Card>

      <Card padded style={{ display: "grid", gap: "var(--sp-5)" }}>
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          <h2 style={{ margin: 0, fontSize: "var(--fs-subtitle)" }}>{t("appearance")}</h2>
          <p style={{ margin: 0, color: "var(--muted)" }}>{t("appearanceHint")}</p>
        </div>
        <div
          role="group"
          aria-label={tTheme("title")}
          style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}
        >
          {(["light", "dark", "system"] as const).map((choice) => (
            <Button key={choice} variant={choice === "light" ? "primary" : "secondary"} size="sm">
              {tTheme(choice)}
            </Button>
          ))}
        </div>
      </Card>

      <Card padded style={{ display: "grid", gap: "var(--sp-5)" }}>
        <div style={{ display: "grid", gap: "var(--sp-2)" }}>
          <h2 style={{ margin: 0, fontSize: "var(--fs-subtitle)" }}>{t("danger.title")}</h2>
          <p style={{ margin: 0, color: "var(--muted)" }}>{t("danger.subtitle")}</p>
        </div>
        <div style={{ display: "flex", gap: "var(--sp-4)", flexWrap: "wrap" }}>
          <Button variant="secondary" leadingIcon={<Download size={15} />}>
            {t("danger.export")}
          </Button>
          <Button variant="danger" leadingIcon={<Trash2 size={15} />}>
            {t("danger.delete")}
          </Button>
        </div>
      </Card>
    </div>
  );
}
