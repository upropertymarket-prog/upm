import { describe, expect, it } from "vitest";

import {
  LEAD_STAGES,
  MAX_RESCHEDULES,
  NOTIFICATION_TYPES,
  VISIT_STATUSES,
  leadStageUpdateSchema,
  messageSchema,
  notificationPrefsSchema,
  prefEnabled,
  rescheduleSchema,
  toProposedAt,
  visitRequestSchema,
} from "./interaction";

/**
 * Schemas da Fase 5 (P5-01 a P5-04). Verificam o que o `zod` promete antes de
 * o pedido chegar ao Postgres — as mesmas regras que a migração impõe por
 * `check` e pelas funções `security definer`.
 */

const tomorrow = () => {
  const date = new Date(Date.now() + 24 * 3600 * 1000);
  return date.toISOString().slice(0, 10);
};
const yesterday = () => {
  const date = new Date(Date.now() - 24 * 3600 * 1000);
  return date.toISOString().slice(0, 10);
};

const UUID = "00000000-0000-4000-8000-000000000001";

describe("enums (05 Anexo A · 07 §5.6 · 07 §18.2)", () => {
  it("visit_status tem os seis estados de 07 §5.6, incluindo completed", () => {
    expect(VISIT_STATUSES).toEqual([
      "pending",
      "accepted",
      "rescheduled",
      "cancelled",
      "completed",
      "archived",
    ]);
  });

  it("lead_stage tem quatro estágios, na ordem do funil (07 §18.2)", () => {
    // A ordem importa: é ela que a migração usa para a lead só avançar.
    expect(LEAD_STAGES).toEqual(["new", "contacted", "visit", "closed"]);
  });

  it("os tipos de notificação são os de 02 §10", () => {
    expect(NOTIFICATION_TYPES).toContain("message");
    expect(NOTIFICATION_TYPES).toContain("visit_request");
    expect(NOTIFICATION_TYPES).toContain("price_drop");
    expect(NOTIFICATION_TYPES).toContain("search_alert");
  });

  it("o limite de reagendamentos é 3 (07 §5.6)", () => {
    expect(MAX_RESCHEDULES).toBe(3);
  });
});

describe("visitRequestSchema (03 F6 passo 1)", () => {
  it("aceita um pedido para amanhã", () => {
    const result = visitRequestSchema.safeParse({
      property_id: UUID,
      date: tomorrow(),
      time: "11:00",
      message: "Seria possível de manhã?",
    });
    expect(result.success).toBe(true);
  });

  it("recusa uma data no passado", () => {
    const result = visitRequestSchema.safeParse({
      property_id: UUID,
      date: yesterday(),
      time: "11:00",
      message: "",
    });
    expect(result.success).toBe(false);
  });

  it("recusa uma hora malformada", () => {
    const result = visitRequestSchema.safeParse({
      property_id: UUID,
      date: tomorrow(),
      time: "11h",
      message: "",
    });
    expect(result.success).toBe(false);
  });

  it("recusa um id de imóvel que não é uuid", () => {
    const result = visitRequestSchema.safeParse({
      property_id: "1041",
      date: tomorrow(),
      time: "11:00",
      message: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("rescheduleSchema", () => {
  it("recusa reagendar para o passado", () => {
    const result = rescheduleSchema.safeParse({ id: UUID, date: yesterday(), time: "10:00" });
    expect(result.success).toBe(false);
  });

  it("aceita uma data futura", () => {
    const result = rescheduleSchema.safeParse({ id: UUID, date: tomorrow(), time: "10:00" });
    expect(result.success).toBe(true);
  });
});

describe("toProposedAt", () => {
  it("junta data e hora num instante único", () => {
    const iso = toProposedAt("2026-10-03", "16:30");
    const date = new Date(iso);
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(9);
    expect(date.getDate()).toBe(3);
    expect(date.getHours()).toBe(16);
    expect(date.getMinutes()).toBe(30);
  });
});

describe("messageSchema (05 §6.3)", () => {
  it("recusa uma mensagem vazia ou só com espaços", () => {
    expect(messageSchema.safeParse({ conversation_id: UUID, body: "   " }).success).toBe(false);
  });

  it("corta os espaços das pontas", () => {
    const result = messageSchema.parse({ conversation_id: UUID, body: "  olá  " });
    expect(result.body).toBe("olá");
  });

  it("recusa acima de 4000 caracteres", () => {
    const result = messageSchema.safeParse({ conversation_id: UUID, body: "a".repeat(4001) });
    expect(result.success).toBe(false);
  });
});

describe("leadStageUpdateSchema (07 §18.2)", () => {
  it("exige desfecho ao fechar", () => {
    const result = leadStageUpdateSchema.safeParse({ id: UUID, stage: "closed", outcome: null });
    expect(result.success).toBe(false);
  });

  it("aceita fechar com desfecho", () => {
    const result = leadStageUpdateSchema.safeParse({ id: UUID, stage: "closed", outcome: "won" });
    expect(result.success).toBe(true);
  });

  it("proíbe desfecho fora de closed — um passo do funil não tem desenlace", () => {
    const result = leadStageUpdateSchema.safeParse({ id: UUID, stage: "visit", outcome: "lost" });
    expect(result.success).toBe(false);
  });
});

describe("preferências de notificação (02 §10)", () => {
  it("ausente = ligado, nos dois canais", () => {
    expect(prefEnabled({}, "message", "inapp")).toBe(true);
    expect(prefEnabled({}, "message", "email")).toBe(true);
    expect(prefEnabled(null, "price_drop", "email")).toBe(true);
  });

  it("um canal desligado não desliga o outro", () => {
    const prefs = { message: { inapp: true, email: false } };
    expect(prefEnabled(prefs, "message", "inapp")).toBe(true);
    expect(prefEnabled(prefs, "message", "email")).toBe(false);
  });

  it("recusa um tipo que não existe", () => {
    const result = notificationPrefsSchema.safeParse({
      inventado: { inapp: true, email: true },
    });
    expect(result.success).toBe(false);
  });
});
