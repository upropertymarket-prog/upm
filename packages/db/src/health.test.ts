import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A verificação de saúde (12 §9.1 · bloqueador B2).
 *
 * O que estes testes prendem é a parte que se perde por descuido: que a
 * resposta é **muda**. É fácil, daqui a seis meses e a depurar uma falha às
 * três da manhã, acrescentar o motivo ao corpo da resposta "só para ver" — e
 * deixá-lo lá. O teste existe para esse dia.
 */
const sondar = vi.fn();

vi.mock("./server", () => ({
  createAnonClient: () => {
    const resultado = sondar();
    if (resultado instanceof Error) throw resultado;
    return {
      from: () => ({
        select: () => ({
          limit: () => ({
            abortSignal: () => resultado,
          }),
        }),
      }),
    };
  },
}));

const { checkHealth, healthResponse } = await import("./health");

let erros: string[] = [];

beforeEach(() => {
  erros = [];
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    erros.push(args.map(String).join(" "));
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  sondar.mockReset();
});

describe("checkHealth", () => {
  it("é `ok` quando a leitura à base de dados passa", async () => {
    sondar.mockReturnValue({ data: [{ key: "launch_mode" }], error: null });
    expect(await checkHealth()).toEqual({ ok: true });
  });

  it("NÃO é `ok` quando a base de dados devolve erro", async () => {
    sondar.mockReturnValue({ data: null, error: { message: "connection refused" } });
    const estado = await checkHealth();
    expect(estado.ok).toBe(false);
    expect(estado.detalhe).toBe("connection refused");
  });

  it("NÃO é `ok` quando falta configuração", async () => {
    sondar.mockReturnValue(new Error("Faltam NEXT_PUBLIC_SUPABASE_URL / ANON_KEY."));
    const estado = await checkHealth();
    expect(estado.ok).toBe(false);
    expect(estado.detalhe).toContain("Faltam");
  });

  it("NÃO é `ok` quando a base de dados aceita e não responde", async () => {
    // O caso mais feio: não recusa, fica pendurada. Sem o `AbortSignal` a
    // verificação ficava à espera e o monitor expirava por conta dele.
    sondar.mockImplementation(() => {
      throw Object.assign(new Error("The operation was aborted"), { name: "TimeoutError" });
    });
    const estado = await checkHealth();
    expect(estado.ok).toBe(false);
  });
});

describe("healthResponse — público, mas mudo", () => {
  it("200 com `{ ok: true }` e nada mais", async () => {
    const resposta = healthResponse({ ok: true }, "web");
    expect(resposta.status).toBe(200);
    expect(await resposta.json()).toEqual({ ok: true });
  });

  it("503 quando não está bom", async () => {
    const resposta = healthResponse({ ok: false, detalhe: "connection refused" }, "app");
    expect(resposta.status).toBe(503);
  });

  it("o motivo NUNCA entra no corpo da resposta", async () => {
    const resposta = healthResponse({ ok: false, detalhe: "senha do Postgres inválida" }, "app");
    const corpo = await resposta.text();

    expect(corpo).toBe(JSON.stringify({ ok: false }));
    expect(corpo).not.toContain("senha");
    expect(corpo).not.toContain("Postgres");
  });

  it("mas o motivo VAI para o log do servidor, que é onde serve", () => {
    healthResponse({ ok: false, detalhe: "connection refused" }, "interno");
    expect(erros.join("\n")).toContain("connection refused");
    expect(erros.join("\n")).toContain("[interno]");
  });

  it("não se cala quando não há detalhe nenhum", () => {
    healthResponse({ ok: false }, "web");
    expect(erros.length).toBe(1);
  });

  it("nada disto fica em cache", () => {
    const resposta = healthResponse({ ok: true }, "web");
    expect(resposta.headers.get("Cache-Control")).toContain("no-store");
  });

  it("um `ok` não escreve no log — senão o log era só isto", () => {
    healthResponse({ ok: true }, "web");
    expect(erros).toEqual([]);
  });
});
