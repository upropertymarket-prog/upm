/**
 * Percurso 1 de 12 §11 — publicar um imóvel, até ao site público
 * =========================================================================
 * O caminho de que vive o negócio: um proprietário preenche o assistente,
 * carrega uma fotografia, submete; um admin aprova no `interno` (com 2FA e o
 * PIN de operação, porque aprovar é uma ação sensível); e o anúncio aparece
 * no site público. Atravessa as três apps e as duas portas de moderação.
 *
 * A conta do proprietário nasce pela API, já confirmada e com plano: o
 * registo e a subscrição têm percursos próprios (`subscrever.spec.ts` e
 * `criar-conta-e-subscrever.spec.ts`), e repeti-los aqui só juntava aqui a
 * dependência do SMTP que o registo tem.
 */
import { expect, test } from "@playwright/test";

import { APP, INTERNO, WEB, temBase } from "../lib/ambiente";
import { anon, apagarContas, criarConta, darPlano, PALAVRA_PASSE, service } from "../lib/contas";
import { entrarComoCliente } from "../lib/sessao";
import { t } from "../lib/textos";
import { codigo, fatorVerificado } from "../lib/totp";

test.skip(!temBase, "Sem credenciais do projeto Supabase");

test.afterAll(async () => {
  await apagarContas();
});

test("o proprietário publica, o admin aprova com 2FA e PIN, e o anúncio aparece no site", async ({
  browser,
}) => {
  test.setTimeout(600_000);
  const dono = await criarConta("owner", "E2E Publica");
  await darPlano(dono.id, "premium-owner");
  const titulo = `E2E Moradia ${Date.now()}`;

  // ---------------------------------------------------------------------
  // 1. O proprietário, no assistente.
  // ---------------------------------------------------------------------
  const cd = await browser.newContext();
  const p = await cd.newPage();
  await entrarComoCliente(p, dono);
  await p.goto(`${APP}/propriedades/nova`);
  // O assistente cria o rascunho ao montar (é dele que os uploads precisam).
  // Em `next dev`, antes da hidratação o botão ainda não sabe que está à
  // espera: espera-se pelo rascunho na base, como uma pessoa espera o ecrã.
  await expect
    .poll(
      async () =>
        (await service().from("properties").select("id").eq("owner_id", dono.id)).data?.length ?? 0,
      { timeout: 90_000 },
    )
    .toBe(1);

  await p.getByRole("textbox", { name: t("newProperty.title"), exact: true }).fill(titulo);
  await p.getByLabel(t("newProperty.dealKind")).selectOption({ index: 0 });
  await p.getByLabel(t("newProperty.propertyType")).selectOption({ label: "Moradia" });
  await p.getByLabel(t("property.fields.typology")).selectOption({ label: "T3" });
  await p.getByLabel(t("newProperty.condition")).selectOption({ label: "Remodelado" });
  await p.getByLabel(t("newProperty.description")).fill("Moradia criada pelo percurso E2E.");
  await p.getByRole("button", { name: t("newProperty.next") }).click();

  // Características: nada obrigatório.
  await p.getByRole("button", { name: t("newProperty.next") }).click();

  await p.getByLabel(t("newProperty.address")).fill("Rua Augusta 100");
  await p.getByLabel(t("newProperty.postalCode")).fill("1100-053");
  await p.getByLabel(t("property.fields.city")).fill("Lisboa");
  await p.getByRole("button", { name: t("newProperty.next") }).click();

  await p.getByLabel(t("newProperty.salePrice")).fill("450000");
  await p.getByRole("button", { name: t("newProperty.next") }).click();

  // Uma fotografia: uma JPEG verdadeira (o upload verifica a assinatura do
  // ficheiro — A11 —, não a extensão). Uma captura de ecrã é exatamente isso.
  const jpeg = await p.screenshot({ type: "jpeg", quality: 70 });
  await p.locator("#property-photos-input").setInputFiles({
    name: "fachada.jpg",
    mimeType: "image/jpeg",
    buffer: jpeg,
  });
  await expect
    .poll(
      async () => {
        const { data } = await service().from("properties").select("id").eq("owner_id", dono.id);
        const id = data?.[0]?.id;
        if (!id) return 0;
        const { count } = await service()
          .from("property_media")
          .select("id", { count: "exact", head: true })
          .eq("property_id", id);
        return count ?? 0;
      },
      { timeout: 90_000 },
    )
    .toBeGreaterThan(0);

  await p.getByRole("button", { name: t("newProperty.publish") }).click();
  await expect(p.getByText(t("newProperty.sentForReview"))).toBeVisible();

  const { data: imovel } = await service()
    .from("properties")
    .select("id, status")
    .eq("owner_id", dono.id)
    .single();
  expect(imovel?.status).toBe("pending_review");
  await cd.close();

  // Antes de aprovado, o site público não o vê: a vista que o `www` lê, como
  // `anon`, não o devolve. Pela vista e não pela página de propósito — a
  // página guarda a resposta 5 min (`unstable_cache`), e quem aprova é o
  // `interno`, que não a invalida (D61). Um pedido aqui guardaria o "não
  // existe" e o anúncio aprovado ficaria escondido até a cache expirar.
  const { data: antes } = await anon().from("properties_public").select("id").eq("id", imovel!.id);
  expect(antes ?? []).toHaveLength(0);

  // ---------------------------------------------------------------------
  // 2. O admin aprova: 2FA, PIN de operação, aprovação.
  // ---------------------------------------------------------------------
  const admin = await criarConta("admin", "E2E Moderadora");
  const segredo = await fatorVerificado(admin.email, PALAVRA_PASSE);
  const ca = await browser.newContext();
  const a = await ca.newPage();
  await a.goto(`${INTERNO}/entrar`);
  await a.getByLabel(t("auth.login.email")).fill(admin.email);
  await a.getByLabel(t("auth.login.password"), { exact: true }).fill(PALAVRA_PASSE);
  await a.getByRole("button", { name: t("auth.login.submit") }).click();
  await expect(a.getByRole("heading", { name: t("auth.mfa.challenge.title") })).toBeVisible();
  // Uma janela nova: o código de `fatorVerificado` já foi usado nesta.
  await new Promise((r) => setTimeout(r, 31_000 - (Date.now() % 30_000)));
  await a.getByLabel(t("auth.mfa.challenge.codeLabel")).fill(codigo(segredo));
  await a.getByRole("button", { name: t("auth.mfa.challenge.submit") }).click();
  await expect(a.getByRole("heading", { name: t("auth.mfa.challenge.title") })).toHaveCount(0);

  // O PIN de operação — sem ele, nenhuma ação sensível passa.
  await a.goto(`${INTERNO}/definicoes/seguranca`);
  await a.getByLabel(t("auth.pin.setup.pinLabel")).fill("482917");
  await a.getByLabel(t("auth.pin.setup.confirmLabel")).fill("482917");
  await a.getByRole("button", { name: t("auth.pin.setup.submit") }).click();
  await expect
    .poll(
      async () =>
        Boolean(
          (
            await service()
              .from("staff_auth")
              .select("pin_hash")
              .eq("profile_id", admin.id)
              .single()
          ).data?.pin_hash,
        ),
      { timeout: 30_000 },
    )
    .toBe(true);

  await a.goto(`${INTERNO}/admin/imoveis`);
  await a.getByText(titulo).click();
  await a.getByRole("button", { name: t("admin.moderation.action.approve") }).click();
  await expect(a.getByText(t("admin.moderation.confirm.approveTitle"))).toBeVisible();
  // O detalhe do imóvel também é um diálogo, com o seu "Aprovar": o da
  // confirmação é o que tem o título da pergunta.
  await a
    .getByRole("dialog")
    .filter({ has: a.getByRole("heading", { name: t("admin.moderation.confirm.approveTitle") }) })
    .getByRole("button", { name: t("admin.moderation.action.approve") })
    .click();
  // Aprovar pede o PIN (step-up).
  await expect(a.getByText(t("auth.pin.stepUp.title"))).toBeVisible();
  await a.getByLabel(t("auth.pin.stepUp.pinLabel")).fill("482917");
  await a.getByRole("button", { name: t("auth.pin.stepUp.submit") }).click();

  await expect
    .poll(
      async () =>
        (await service().from("properties").select("status").eq("id", imovel!.id).single()).data
          ?.status,
      { timeout: 60_000 },
    )
    .toBe("active");
  await ca.close();

  // ---------------------------------------------------------------------
  // 3. O anúncio aparece no site público, para um visitante sem conta.
  // ---------------------------------------------------------------------
  const visitante = await browser.newContext();
  const v = await visitante.newPage();
  await v.goto(`${WEB}/propriedades/x-${imovel!.id}`);
  await expect(v.getByRole("heading", { name: titulo })).toBeVisible();
  await visitante.close();

  // E ficou registado quem aprovou (A8).
  const { data: rasto } = await service()
    .from("audit_log")
    .select("action, actor_id")
    .eq("entity_id", imovel!.id)
    .eq("actor_id", admin.id);
  expect((rasto ?? []).map((r) => r.action)).toContain("property.approved");
});
