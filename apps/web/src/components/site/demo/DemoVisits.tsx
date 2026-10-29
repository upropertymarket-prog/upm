"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { CalendarClock, CalendarDays, Check, MapPin, RotateCcw, User, X } from "lucide-react";
import { Button, Card, EmptyState, StatusTag, Tabs, type StatusTone } from "@upm/ui";
import { DEMO_BUYER_VISITS, DEMO_OWNER_VISITS, type DemoVisit } from "@upm/ui/demo-data";

import { useDemoFormat, type DemoRole } from "./format";

/**
 * Agenda de visitas e Meus pedidos — 04 §8.4 · 03 F6
 * =========================================================================
 * É o **mesmo ecrã** para os dois lados, como no produto (`VisitsScreen` serve
 * `/agenda` e `/meus-pedidos`): muda quem propôs a data e, com isso, quem pode
 * aceitar. As tabs de estado filtram, que é o que elas fazem no produto;
 * aceitar e reagendar desenham-se.
 *
 * A vista de calendário fica de fora. Não por custo: um botão "Calendário" que
 * não mostra um calendário ensina ao visitante o contrário do que a
 * demonstração existe para mostrar, e um mês inteiro de grelha dentro de uma
 * caixa de 620 px não se lê. O que está aqui é a lista, completa.
 */

const VISIT_TONE: Record<DemoVisit["status"], StatusTone> = {
  pending: "visitPending",
  accepted: "visitAccepted",
  rescheduled: "visitRescheduled",
  completed: "visitCompleted",
};

const FILTERS: (DemoVisit["status"] | "all")[] = ["all", "pending", "accepted", "completed"];

export function DemoVisits({ role }: { role: DemoRole }) {
  const t = useTranslations("visits");
  const tCommon = useTranslations("common");
  const format = useDemoFormat();
  const [filter, setFilter] = useState<string>("all");

  const rows = role === "owner" ? DEMO_OWNER_VISITS : DEMO_BUYER_VISITS;
  const visible = filter === "all" ? rows : rows.filter((visit) => visit.status === filter);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-6)" }}>
      <Tabs
        label={t("filterLabel")}
        value={filter}
        onValueChange={setFilter}
        items={FILTERS.map((id) => ({
          id,
          label: id === "all" ? t("filterAll") : t(`status.${id}`),
          count: id === "all" ? rows.length : rows.filter((visit) => visit.status === id).length,
        }))}
      />

      {visible.length === 0 ? (
        <EmptyState
          title={t("emptyFilter")}
          description={role === "owner" ? t("emptyOwner") : t("emptyBuyer")}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
          {visible.map((visit) => {
            const when = format.at(visit.dayOffset, visit.minuteOfDay);
            const open = visit.status === "pending" || visit.status === "rescheduled";
            return (
              <Card key={visit.id} padded>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 240px), 1fr))",
                    gap: "var(--sp-6)",
                  }}
                >
                  <div style={{ display: "grid", gap: "var(--sp-2)", minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--sp-3)",
                        flexWrap: "wrap",
                      }}
                    >
                      <strong style={{ fontSize: "var(--fs-body-lg)" }}>{visit.property}</strong>
                      <StatusTag tone={VISIT_TONE[visit.status]}>
                        {t(`status.${visit.status}`)}
                      </StatusTag>
                    </div>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--sp-2)",
                        color: "var(--muted)",
                      }}
                    >
                      <MapPin size={13} aria-hidden="true" />
                      {visit.city}
                    </span>
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--sp-2)",
                        color: "var(--muted)",
                      }}
                    >
                      <User size={13} aria-hidden="true" />
                      {visit.other}
                    </span>
                  </div>

                  <div style={{ display: "grid", gap: "var(--sp-4)", minWidth: 0 }}>
                    <div style={{ display: "flex", gap: "var(--sp-6)", flexWrap: "wrap" }}>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--sp-2)",
                          fontWeight: "var(--fw-bold)",
                        }}
                      >
                        <CalendarDays size={14} aria-hidden="true" color="var(--accent)" />
                        {format.date(when)}
                      </span>
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--sp-2)",
                          fontWeight: "var(--fw-bold)",
                        }}
                      >
                        <CalendarClock size={14} aria-hidden="true" color="var(--accent)" />
                        {format.time(when)}
                      </span>
                    </div>
                    <span style={{ color: "var(--muted)" }}>
                      {t.rich("reschedulesLine", {
                        used: "0",
                        max: "2",
                        count: (chunks) => (
                          <span style={{ fontWeight: "var(--fw-semibold)" }}>{chunks}</span>
                        ),
                      })}
                    </span>
                    {open ? (
                      <div style={{ display: "flex", gap: "var(--sp-3)", flexWrap: "wrap" }}>
                        <Button size="sm" leadingIcon={<Check size={14} />}>
                          {t("accept")}
                        </Button>
                        <Button variant="secondary" size="sm" leadingIcon={<RotateCcw size={14} />}>
                          {t("reschedule")}
                        </Button>
                        <Button variant="ghost" size="sm" leadingIcon={<X size={14} />}>
                          {tCommon("cancel")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
