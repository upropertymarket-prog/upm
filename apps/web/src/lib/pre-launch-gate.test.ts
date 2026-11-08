import { afterEach, describe, expect, it, vi } from "vitest";

import { modoForcado } from "./launch-mode-override";
import { deveRedirecionar, destinoNoPre } from "./pre-launch-gate";

describe("destinoNoPre — em pré-lançamento só a página de pré-lançamento", () => {
  it("serve a página, a pré-inscrição e as legais, nas duas línguas", () => {
    for (const aberto of [
      "/",
      "/pre-inscricao",
      "/pre-inscricao/confirmar",
      "/pre-inscricao/remover",
      "/termos",
      "/privacidade",
      "/cookies",
      "/cancelar-subscricao",
      "/en",
      "/en/early-access",
      "/en/early-access/confirm",
      "/en/early-access/remove",
      "/en/terms",
      "/en/privacy",
      "/en/cookies",
      "/en/cancel-subscription",
      "/pt/termos",
      "/termos/",
    ]) {
      expect(destinoNoPre(aberto), aberto).toBeNull();
    }
  });

  it("manda de volta o registo, a entrada, o catálogo e o que não existe", () => {
    for (const fechado of [
      "/criar-conta",
      "/criar-conta/verificacao",
      "/entrar",
      "/recuperar-palavra-passe",
      "/recuperar-palavra-passe/confirmar",
      "/propriedades",
      "/propriedades/t2-lisboa",
      "/nao-existe",
      "/pt/criar-conta",
      "/termos-falsos",
    ]) {
      expect(destinoNoPre(fechado), fechado).toBe("/");
    }
    for (const fechado of ["/en/sign-up", "/en/sign-in", "/en/properties", "/en/nope"]) {
      expect(destinoNoPre(fechado), fechado).toBe("/en");
    }
  });

  it("não toca nos ficheiros de `public/`", () => {
    expect(destinoNoPre("/brand/logo.svg")).toBeNull();
  });

  it("em `post` não redireciona nada", () => {
    expect(deveRedirecionar("post", "/criar-conta")).toBeNull();
    expect(deveRedirecionar("pre", "/criar-conta")).toBe("/");
  });
});

describe("modoForcado — só fora de produção", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("é ignorado em produção, mesmo que alguém o deixe no painel", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("UPM_LAUNCH_MODE_OVERRIDE", "post");
    expect(modoForcado()).toBeNull();
  });

  it("vale em desenvolvimento, e só com um valor conhecido", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("UPM_LAUNCH_MODE_OVERRIDE", "post");
    expect(modoForcado()).toBe("post");
    vi.stubEnv("UPM_LAUNCH_MODE_OVERRIDE", "aberto");
    expect(modoForcado()).toBeNull();
  });
});
