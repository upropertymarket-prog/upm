import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Apagar a pré-inscrição pelo link do e-mail (8 nov 2026)
 * =========================================================================
 * A função SQL tem o seu teste contra a base; aqui guarda-se o que é desta
 * camada: um token com outra forma não chega à base, e uma recusa da base é
 * um "este link já não serve", nunca um "removida".
 */

const rpc = vi.fn();
vi.mock("@upm/db/server", () => ({ createAnonClient: () => ({ rpc }) }));

const { removePreRegistration } = await import("./actions");

const TOKEN = "a".repeat(64);

function form(token: string | null) {
  const data = new FormData();
  if (token !== null) data.set("token", token);
  return data;
}

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: true, error: null });
});

describe("removePreRegistration", () => {
  it("apaga com o token do link", async () => {
    expect(await removePreRegistration({}, form(TOKEN))).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("remove_site_lead", { p_token: TOKEN });
  });

  it("recusa um token com outra forma, sem tocar na base", async () => {
    for (const token of [null, "", "abc", "Z".repeat(64), `${TOKEN}0`]) {
      expect(await removePreRegistration({}, form(token)), String(token)).toEqual({
        failed: true,
      });
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("um link já usado, ou um erro da base, é 'já não serve'", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await removePreRegistration({}, form(TOKEN))).toEqual({ failed: true });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    expect(await removePreRegistration({}, form(TOKEN))).toEqual({ failed: true });
  });
});
