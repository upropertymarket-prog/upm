import { describe, expect, it } from "vitest";

import {
  drainOutbox,
  MAX_ATTEMPTS,
  type OutboundEmail,
} from "../../../supabase/functions/_shared/outbox-core.ts";

/**
 * As regras da fila, contra uma base em memória (7 nov 2026)
 * =========================================================================
 * O núcleo corre na Edge Function do pré-lançamento e no worker; estes testes
 * são a prova das regras dele, sem rede. A base falsa implementa só o que a
 * fila usa (`update`/`select`/`eq`/`lt`/`order`/`limit`/`maybeSingle`), mas
 * filtra a sério: um `update` com `eq("status", "queued")` não toca numa
 * linha que já está `sending`, que é exatamente a corrida que a regra 1 fecha.
 */

type Linha = {
  id: string;
  recipient: string;
  payload: Record<string, unknown>;
  status: "queued" | "sending" | "sent" | "failed" | "cancelled";
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

function baseFalsa(linhas: Linha[]) {
  function consulta() {
    const filtros: Array<(l: Linha) => boolean> = [];
    let alteracoes: Partial<Linha> | null = null;
    let limite = Infinity;
    const correr = () => {
      const alvo = linhas.filter((l) => filtros.every((f) => f(l)));
      if (alteracoes) for (const l of alvo) Object.assign(l, alteracoes);
      return alvo.slice(0, limite).map((l) => ({ ...l }));
    };
    const q = {
      select: () => q,
      update: (v: Partial<Linha>) => ((alteracoes = v), q),
      eq: (c: keyof Linha, v: unknown) => (filtros.push((l) => l[c] === v), q),
      lt: (c: keyof Linha, v: never) => (filtros.push((l) => (l[c] as never) < v), q),
      order: () => q,
      limit: (n: number) => {
        limite = n;
        return Promise.resolve({ data: correr(), error: null });
      },
      maybeSingle: () => Promise.resolve({ data: correr()[0] ?? null, error: null }),
      then: (resolve: (r: { data: Linha[]; error: null }) => unknown) =>
        resolve({ data: correr(), error: null }),
    };
    return q;
  }
  return { from: () => consulta() };
}

function linha(id: string, extra: Partial<Linha> = {}): Linha {
  return {
    id,
    recipient: `${id}@exemplo.pt`,
    payload: { title: "Confirme o seu e-mail", body: "Olá", link: "https://www.x.pt/c?t=1" },
    status: "queued",
    attempts: 0,
    last_error: null,
    sent_at: null,
    created_at: "2026-11-07T10:00:00Z",
    updated_at: "2026-11-07T10:00:00Z",
    ...extra,
  };
}

const AGORA = new Date("2026-11-07T12:00:00Z");
const opcoes = { batch: 20, appUrl: "https://app.x.pt", now: AGORA };

describe("drainOutbox", () => {
  it("envia o que está em fila, com o id da entrega como chave de idempotência", async () => {
    const linhas = [linha("a"), linha("b")];
    const enviados: OutboundEmail[] = [];
    const r = await drainOutbox(baseFalsa(linhas), async (e) => void enviados.push(e), opcoes);

    expect(r.sent).toBe(2);
    expect(enviados.map((e) => e.idempotencyKey)).toEqual(["a", "b"]);
    expect(enviados[0]!.subject).toBe("Confirme o seu e-mail");
    expect(linhas.every((l) => l.status === "sent" && l.sent_at)).toBe(true);
  });

  it("uma falha volta à fila com o motivo, e à quinta fica failed", async () => {
    const linhas = [linha("a"), linha("b", { attempts: MAX_ATTEMPTS - 1 })];
    const r = await drainOutbox(
      baseFalsa(linhas),
      async () => {
        throw new Error("Resend 503");
      },
      opcoes,
    );

    expect(r.failed).toBe(2);
    expect(linhas[0]).toMatchObject({ status: "queued", attempts: 1, last_error: "Resend 503" });
    expect(linhas[1]).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS });
  });

  it("não toca no que outra passagem já marcou", async () => {
    const linhas = [linha("a", { status: "sending", updated_at: "2026-11-07T11:58:00Z" })];
    const enviados: OutboundEmail[] = [];
    await drainOutbox(baseFalsa(linhas), async (e) => void enviados.push(e), opcoes);

    expect(enviados).toEqual([]);
    expect(linhas[0]!.status).toBe("sending");
  });

  it("devolve à fila o que ficou preso em sending há mais de 15 minutos, e envia-o", async () => {
    const linhas = [linha("a", { status: "sending", updated_at: "2026-11-07T11:30:00Z" })];
    const enviados: OutboundEmail[] = [];
    const r = await drainOutbox(baseFalsa(linhas), async (e) => void enviados.push(e), opcoes);

    expect(r.recovered).toBe(1);
    expect(enviados.map((e) => e.idempotencyKey)).toEqual(["a"]);
    expect(linhas[0]!.status).toBe("sent");
  });

  it("deixa em paz o que já foi enviado, cancelado ou falhou de vez", async () => {
    const linhas = [
      linha("a", { status: "sent" }),
      linha("b", { status: "cancelled" }),
      linha("c", { status: "failed", attempts: MAX_ATTEMPTS }),
    ];
    const enviados: OutboundEmail[] = [];
    await drainOutbox(baseFalsa(linhas), async (e) => void enviados.push(e), opcoes);
    expect(enviados).toEqual([]);
  });
});
