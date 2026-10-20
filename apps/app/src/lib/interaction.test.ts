import { describe, expect, it } from "vitest";

import { countersFor } from "./interaction";
import { currentMonth } from "./dates";
import {
  formatDay,
  formatRelative,
  formatTime,
  initialsOf,
  type ConversationSummary,
  type LeadRow,
  type VisitRow,
} from "../components/interaction/interactionTypes";

/**
 * Lógica pura da Fase 5: os contadores da sidebar (07 §4.2/§4.3) e a
 * formatação da lista de conversas e da agenda. O que fala com o Supabase
 * (RLS, funções de estado, gatilhos) é verificado contra staging em
 * `packages/db/src/rls-matrix.test.ts`.
 */

const NOW = new Date("2026-09-29T12:00:00Z");

function conversation(partial: Partial<ConversationSummary> = {}): ConversationSummary {
  return {
    id: "c1",
    propertyId: "p1",
    propertyTitle: "T3 Campo de Ourique",
    propertyLocation: "Lisboa",
    other: { id: "u1", name: "João Costa", initials: "JC" },
    lastMessage: "Olá",
    lastMessageAt: NOW.toISOString(),
    unread: 0,
    ...partial,
  };
}

function visit(partial: Partial<VisitRow> = {}): VisitRow {
  return {
    id: "v1",
    propertyId: "p1",
    propertyTitle: "T3 Campo de Ourique",
    propertyLocation: "Lisboa",
    other: { id: "u1", name: "João Costa", initials: "JC" },
    proposedAt: "2026-10-03T16:30:00Z",
    message: "",
    status: "pending",
    rescheduleCount: 0,
    proposedByMe: false,
    ...partial,
  };
}

function lead(partial: Partial<LeadRow> = {}): LeadRow {
  return {
    id: "l1",
    propertyId: "p1",
    propertyTitle: "T3 Campo de Ourique",
    propertyLocation: "Lisboa",
    contact: { id: "u1", name: "João Costa", initials: "JC" },
    stage: "new",
    outcome: null,
    lastMessage: "",
    lastActivityAt: NOW.toISOString(),
    conversationId: "c1",
    ...partial,
  };
}

describe("countersFor (07 §4.2/§4.3)", () => {
  it("o contador de Mensagens soma as por ler, não as conversas", () => {
    const counters = countersFor(
      "owner",
      [conversation({ id: "a", unread: 2 }), conversation({ id: "b", unread: 3 })],
      [],
      [],
    );
    expect(counters.messages).toBe(5);
  });

  it("uma visita cuja data fui eu a propor não conta — está à espera do outro", () => {
    const counters = countersFor(
      "owner",
      [],
      [
        visit({ id: "1", status: "rescheduled", proposedByMe: true }),
        visit({ id: "2", status: "pending", proposedByMe: false }),
      ],
      [],
    );
    expect(counters.visitSchedule).toBe(1);
  });

  it("uma visita aceite ou cancelada não pede resposta nenhuma", () => {
    const counters = countersFor(
      "owner",
      [],
      [visit({ id: "1", status: "accepted" }), visit({ id: "2", status: "cancelled" })],
      [],
    );
    expect(counters.visitSchedule).toBe(0);
  });

  it("o contador de Leads conta as que ainda estão vivas no funil", () => {
    const counters = countersFor(
      "owner",
      [],
      [],
      [
        lead({ id: "1", stage: "new" }),
        lead({ id: "2", stage: "contacted" }),
        lead({ id: "3", stage: "visit" }),
        lead({ id: "4", stage: "closed", outcome: "won" }),
      ],
    );
    expect(counters.leads).toBe(2);
  });

  it("o comprador tem Meus pedidos e não tem Leads nem Agenda", () => {
    const counters = countersFor("buyer", [conversation({ unread: 1 })], [visit()], []);
    expect(counters).toEqual({ messages: 1, myRequests: 1 });
  });
});

describe("formatRelative", () => {
  const at = (iso: string) => formatRelative(iso, "pt-PT", NOW);
  const em = (iso: string) => formatRelative(iso, "en-GB", NOW);

  it("minutos, horas, ontem e dias", () => {
    expect(at("2026-09-29T11:58:00Z")).toBe("há 2 minutos");
    expect(at("2026-09-29T10:00:00Z")).toBe("há 2 horas");
    expect(at("2026-09-28T12:00:00Z")).toBe("ontem");
    expect(at("2026-09-26T12:00:00Z")).toBe("há 3 dias");
  });

  // A razão de ser de D72: a mesma linha, no outro idioma. As frases saem do
  // `Intl.RelativeTimeFormat` e não de chaves escritas à mão.
  it("a mesma escala em inglês", () => {
    expect(em("2026-09-29T10:00:00Z")).toBe("2 hours ago");
    expect(em("2026-09-28T12:00:00Z")).toBe("yesterday");
  });

  it("acima de uma semana passa a data, não a contagem", () => {
    // "10 set 2026" — o formato da referência, com o mês por extenso curto.
    expect(at("2026-09-10T12:00:00Z")).toBe("10 set 2026");
    expect(em("2026-09-10T12:00:00Z")).toBe("10 Sept 2026");
  });

  it("uma hora no singular", () => {
    expect(at("2026-09-29T11:00:00Z")).toBe("há 1 hora");
  });
});

describe("formatação da agenda", () => {
  it("a hora usa o 'h' português, não os dois pontos", () => {
    expect(formatTime("2026-10-03T16:30:00Z", "pt-PT")).toMatch(/^\d{2}h\d{2}$/);
    // Em inglês mantêm-se os dois pontos: o `h` é convenção portuguesa, e
    // trocá-lo nos dois idiomas era exportar a nossa pontuação.
    expect(formatTime("2026-10-03T16:30:00Z", "en-GB")).toMatch(/^\d{2}:\d{2}$/);
  });

  it("o cartão de dia traz dia e mês curtos, sem ponto final", () => {
    const { day, month } = formatDay("2026-10-03T16:30:00Z", "pt-PT");
    expect(day).toMatch(/^\d{2}$/);
    expect(month).not.toContain(".");
  });
});

describe("initialsOf", () => {
  it("usa as duas primeiras palavras", () => {
    expect(initialsOf("Ana Silva Costa")).toBe("AS");
  });

  it("aguenta um nome só e um nome vazio", () => {
    expect(initialsOf("Ana")).toBe("A");
    expect(initialsOf("")).toBe("?");
  });
});

describe("currentMonth", () => {
  it("devolve YYYY-MM com o mês acolchoado", () => {
    expect(currentMonth(new Date(2026, 8, 29))).toBe("2026-09");
    expect(currentMonth(new Date(2026, 11, 1))).toBe("2026-12");
  });
});
