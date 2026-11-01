import { describe, expect, it } from "vitest";

import { SIGNATURE_DARK_MODE_CSS, wrapOutgoingEmail } from "./signature-email";
import { SIGNATURE_TEMPLATE } from "./signatures";

describe("wrapOutgoingEmail", () => {
  it("com a assinatura, o e-mail sai com o color-scheme e a folha do modo escuro", () => {
    const html = wrapOutgoingEmail(`<p>Olá</p><hr />${SIGNATURE_TEMPLATE}`);
    expect(html).toMatch(/^<!doctype html><html><head>/);
    expect(html).toContain('<meta name="color-scheme" content="light dark">');
    expect(html).toContain(`<style>${SIGNATURE_DARK_MODE_CSS}</style>`);
    expect(html).toContain("<body><p>Olá</p>");
  });

  it("a folha cobre a media query e o caminho do Outlook.com", () => {
    expect(SIGNATURE_DARK_MODE_CSS).toContain("@media (prefers-color-scheme: dark)");
    expect(SIGNATURE_DARK_MODE_CSS).toContain("[data-ogsc] .upm-sig-logo-dark");
  });

  it("sem assinatura, embrulha mas não acrescenta folha", () => {
    const html = wrapOutgoingEmail("<p>Olá</p>");
    expect(html).not.toContain("<style>");
    expect(html).not.toContain("color-scheme");
  });

  it("o que já é um documento sai como veio", () => {
    const doc = "<!doctype html><html><body><p>a</p></body></html>";
    expect(wrapOutgoingEmail(doc)).toBe(doc);
  });
});
