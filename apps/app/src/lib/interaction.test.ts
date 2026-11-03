import { describe, expect, it } from "vitest";

import { loadNavCounters } from "./interaction";
import { currentMonth } from "./dates";
import {
  formatDay,
  formatRelative,
  formatTime,
  initialsOf,
} from "../components/interaction/interactionTypes";

/**
 * Lógica pura da Fase 5: a leitura dos contadores da sidebar e a
 * formatação da lista de conversas e da agenda. O que fala com o Supabase
 * (RLS, funções de estado, gatilhos) é verificado contra staging em
 * `packages/db/src/rls-matrix.test.ts`.
 */

const NOW = new Date("2026-09-29T12:00:00Z");

/** Um cliente que só sabe responder ao `my_nav_counters`. */
function clienteCom(resposta: { data: unknown; error: unknown }) {
  return { rpc: async () => resposta } as unknown as Parameters<typeof loadNavCounters>[0];
}

/*
 * As regras dos contadores (somar as por ler, a visita que eu propus não
 * conta, leads só em new/contacted) passaram para SQL no F4 e testam-se lá,
 * contra a base: `packages/db/src/nav-counters.test.ts`. Aqui fica o que é
 * de cá — que chaves cada papel recebe, e que uma falha não parte a página.
 */
describe("loadNavCounters (07 §4.2/§4.3 · F4)", () => {
  const contados = { data: { messages: 5, waiting: 1, leads: 2 }, error: null };

  it("o proprietário tem Mensagens, Agenda e Leads", async () => {
    expect(await loadNavCounters(clienteCom(contados), "owner")).toEqual({
      messages: 5,
      visitSchedule: 1,
      leads: 2,
    });
  });

  it("o comprador tem Meus pedidos e não tem Leads nem Agenda", async () => {
    expect(await loadNavCounters(clienteCom(contados), "buyer")).toEqual({
      messages: 5,
      myRequests: 1,
    });
  });

  it("se a leitura falhar, zeros — o menu não impede a página de abrir", async () => {
    const falhou = clienteCom({ data: null, error: { message: "boom" } });
    expect(await loadNavCounters(falhou, "owner")).toEqual({
      messages: 0,
      visitSchedule: 0,
      leads: 0,
    });
  });

  it("um valor que não é número conta como zero", async () => {
    const estranho = clienteCom({ data: { messages: "5", waiting: null }, error: null });
    expect(await loadNavCounters(estranho, "buyer")).toEqual({ messages: 0, myRequests: 0 });
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
