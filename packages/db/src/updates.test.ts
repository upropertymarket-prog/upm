import { describe, expect, it } from "vitest";

import {
  APP_UPDATE_DELIVERIES,
  APP_UPDATE_STATUS_TONES,
  appUpdateSaveSchema,
  sanitizeUpdateBody,
  updateBodyFindings,
} from "./updates";
import { USER_ROLES, isInternalRole, isStaffRole, type UserRole } from "./types";

/**
 * O corpo de uma novidade é mostrado por `innerHTML` **dentro da app
 * autenticada de um cliente** (`AppUpdatesModal`). O que se testa aqui é o que
 * decide se um `<script>` escrito ou colado no editor chega lá.
 *
 * E testa-se a fronteira do papel novo, que é a decisão mais consequente de
 * 07 §24.6: `is_staff()` não inclui o marketing, e um dia em que isso mudar por
 * descuido dá-lhe a moderação de imóveis e o diretório de utilizadores.
 */

describe("sanitizeUpdateBody", () => {
  it("tira o script e não deixa o código como texto", () => {
    const clean = sanitizeUpdateBody("<p>Olá</p><script>alert(1)</script>");
    expect(clean).not.toContain("script");
    expect(clean).not.toContain("alert(1)");
    expect(clean).toContain("Olá");
  });

  it("tira `<style>`, que numa app vazaria para fora do modal", () => {
    const clean = sanitizeUpdateBody("<style>body{display:none}</style><p>a</p>");
    expect(clean).not.toContain("display:none");
  });

  it("tira os atributos de evento", () => {
    expect(sanitizeUpdateBody('<p onclick="alert(1)">a</p>')).not.toContain("onclick");
  });

  it("recusa `javascript:` e mantém `https:`", () => {
    expect(sanitizeUpdateBody('<a href="javascript:alert(1)">x</a>')).not.toContain("javascript");
    expect(sanitizeUpdateBody('<a href="https://upropertymarket.pt">x</a>')).toContain("https://");
  });

  it("abre as ligações noutro separador, sem passar o referrer", () => {
    const clean = sanitizeUpdateBody('<a href="https://upropertymarket.pt">x</a>');
    expect(clean).toContain('target="_blank"');
    expect(clean).toContain('rel="noopener noreferrer"');
  });

  it("mantém o que uma novidade precisa: prosa, listas, cabeçalhos e imagens", () => {
    const clean = sanitizeUpdateBody(
      '<h2>Novo</h2><p><strong>a</strong> e <em>b</em></p><ul><li>c</li></ul><img src="https://x.pt/a.png" alt="a" />',
    );
    expect(clean).toContain("<h2>");
    expect(clean).toContain("<strong>");
    expect(clean).toContain("<li>");
    expect(clean).toContain("<img");
  });

  it("tira o `h1`, porque o título do modal já é o cabeçalho de nível 1", () => {
    // 04 §1.7: a hierarquia de cabeçalhos é o que os leitores de ecrã seguem.
    const clean = sanitizeUpdateBody("<h1>Título</h1>");
    expect(clean).not.toContain("<h1");
    expect(clean).toContain("Título");
  });
});

describe("updateBodyFindings", () => {
  it("diz o que vai sair, por etiqueta e por atributo", () => {
    const findings = updateBodyFindings('<script>a</script><p onclick="x">b</p>');
    expect(findings).toContain("<script>");
    expect(findings).toContain("onclick=");
  });

  it("não avisa quando o sanitizador só arruma a marcação", () => {
    expect(updateBodyFindings("<p>Olá<br></p>")).toHaveLength(0);
  });

  it("não repete o mesmo aviso", () => {
    const findings = updateBodyFindings("<script>a</script><script>b</script>");
    expect(findings.filter((item) => item === "<script>")).toHaveLength(1);
  });
});

describe("appUpdateSaveSchema", () => {
  it("exige título", () => {
    expect(appUpdateSaveSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("tem valores por omissão para tudo o que não é o título", () => {
    const result = appUpdateSaveSchema.safeParse({ title: "Novidade" });
    expect(result.success).toBe(true);
    expect(result.data?.audience).toBe("all");
    expect(result.data?.delivery).toBe("next_login");
    expect(result.data?.points).toEqual([]);
  });

  it("recusa mais de doze pontos — o modal deixa de ser legível", () => {
    const points = Array.from({ length: 13 }, (_, at) => `ponto ${at}`);
    expect(appUpdateSaveSchema.safeParse({ title: "a", points }).success).toBe(false);
  });

  it("recusa uma data de agendamento sem fuso", () => {
    // O `datetime-local` do ecrã não leva fuso; é o ecrã que converte para ISO
    // antes de chamar a action. Aceitar aqui uma data sem fuso era aceitar uma
    // hora que significa coisas diferentes no servidor e no browser.
    expect(
      appUpdateSaveSchema.safeParse({ title: "a", scheduledFor: "2026-10-20T09:00" }).success,
    ).toBe(false);
    expect(
      appUpdateSaveSchema.safeParse({ title: "a", scheduledFor: "2026-10-20T09:00:00+01:00" })
        .success,
    ).toBe(true);
  });

  it("as três entregas de 04 §2.6, e só estas", () => {
    expect(APP_UPDATE_DELIVERIES).toEqual(["banner", "next_login", "mandatory"]);
  });

  it("cada estado tem um tom, e nenhum fica sem", () => {
    for (const status of ["draft", "scheduled", "published", "archived"] as const) {
      expect(APP_UPDATE_STATUS_TONES[status]).toBeTruthy();
    }
  });
});

describe("a fronteira do papel marketing (07 §24.6)", () => {
  it("`marketing` é um papel conhecido", () => {
    expect(USER_ROLES).toContain("marketing");
  });

  it("**não** é staff — é a decisão mais consequente de §24.6", () => {
    // Alargar `is_staff()` dava-lhe a moderação de imóveis, as leads do site, o
    // diretório de utilizadores e os tickets de uma vez, em silêncio.
    expect(isStaffRole("marketing")).toBe(false);
    expect(isStaffRole("admin")).toBe(true);
    expect(isStaffRole("support")).toBe(true);
  });

  it("é equipa interna — é o que `is_internal()` existe para dizer", () => {
    expect(isInternalRole("marketing")).toBe(true);
    for (const role of ["buyer", "owner"] as UserRole[]) {
      expect(isInternalRole(role)).toBe(false);
      expect(isStaffRole(role)).toBe(false);
    }
  });
});
