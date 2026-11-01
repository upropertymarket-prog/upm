import { describe, expect, it } from "vitest";

import {
  reconcileSubscriptions,
  type SubscricaoLocal,
  type SubscricaoStripe,
} from "./billing-reconcile";

/**
 * A conciliação (12 §7.2).
 *
 * O caso que justifica isto existir é o primeiro teste: o Stripe diz `active`,
 * o Postgres diz `canceled`, e a pessoa pagou e não entra. Hoje isso acontece
 * em silêncio — nenhum erro, nenhum alerta, só um cliente a escrever ao
 * Suporte a dizer que a app não o deixa entrar.
 *
 * A segunda metade é tão importante: **não inventar divergências**. Um
 * relatório que acusa vinte coisas por dia, das quais dezanove são ruído, é um
 * relatório que ninguém abre ao fim de uma semana — e aí volta a ser igual a
 * não o ter.
 */
const stripe = (over: Partial<SubscricaoStripe> = {}): SubscricaoStripe => ({
  stripeSubscriptionId: "sub_1",
  customerEmail: "cliente@exemplo.pt",
  status: "active",
  currentPeriodEnd: "2026-12-01T00:00:00.000Z",
  cancelAtPeriodEnd: false,
  ...over,
});

const local = (over: Partial<SubscricaoLocal> = {}): SubscricaoLocal => ({
  stripeSubscriptionId: "sub_1",
  profileId: "perfil-1",
  status: "active",
  currentPeriodEnd: "2026-12-01T00:00:00.000Z",
  cancelAtPeriodEnd: false,
  ...over,
});

describe("as divergências que tiram ou dão acesso", () => {
  it("pagou e não entra", () => {
    const [d] = reconcileSubscriptions(
      [stripe({ status: "active" })],
      [local({ status: "canceled" })],
    );
    expect(d?.tipo).toBe("paga_sem_acesso");
    expect(d?.afetaAcesso).toBe(true);
  });

  it("cancelou e continua a entrar", () => {
    const [d] = reconcileSubscriptions(
      [stripe({ status: "canceled" })],
      [local({ status: "active" })],
    );
    expect(d?.tipo).toBe("acesso_sem_pagar");
    expect(d?.afetaAcesso).toBe(true);
  });

  it("o Stripe tem uma subscrição que nós nunca soubemos", () => {
    const [d] = reconcileSubscriptions([stripe({ status: "active" })], []);
    expect(d?.tipo).toBe("ausente_no_postgres");
    expect(d?.afetaAcesso).toBe(true);
  });

  it("nós temos uma que o Stripe não conhece, e ainda dá acesso", () => {
    const [d] = reconcileSubscriptions([], [local({ status: "active" })]);
    expect(d?.tipo).toBe("ausente_no_stripe");
    expect(d?.afetaAcesso).toBe(true);
  });

  it("`trialing` dá acesso — logo não é `paga_sem_acesso`", () => {
    const [d] = reconcileSubscriptions(
      [stripe({ status: "trialing" })],
      [local({ status: "active" })],
    );
    // Mas continua a ser um estado diferente, e isso conta: um trial acaba e
    // converte, e uma linha que diz `active` não sabe quando.
    expect(d?.tipo).toBe("estado_diferente");
    expect(d?.afetaAcesso).toBe(false);
  });

  it("`trialing` dos dois lados não produz nada", () => {
    expect(
      reconcileSubscriptions([stripe({ status: "trialing" })], [local({ status: "trialing" })]),
    ).toEqual([]);
  });

  it("as que mexem com acesso vêm primeiro no relatório", () => {
    const resultado = reconcileSubscriptions(
      [
        stripe({ stripeSubscriptionId: "sub_a", cancelAtPeriodEnd: true }),
        stripe({ stripeSubscriptionId: "sub_b", status: "canceled" }),
      ],
      [
        local({ stripeSubscriptionId: "sub_a", cancelAtPeriodEnd: false }),
        local({ stripeSubscriptionId: "sub_b", status: "active" }),
      ],
    );
    expect(resultado[0]?.afetaAcesso).toBe(true);
    expect(resultado[0]?.stripeSubscriptionId).toBe("sub_b");
  });
});

describe("as que não mexem com acesso, mas contam", () => {
  it("estados diferentes dentro do mesmo lado da fronteira", () => {
    // `past_due` e `canceled` não dão acesso nenhum dos dois, mas não são a
    // mesma coisa: um ainda se recupera.
    const [d] = reconcileSubscriptions(
      [stripe({ status: "past_due" })],
      [local({ status: "canceled" })],
    );
    expect(d?.tipo).toBe("estado_diferente");
    expect(d?.afetaAcesso).toBe(false);
  });

  it("o fim do período divergiu — a renovação pode não ter sido registada", () => {
    const [d] = reconcileSubscriptions(
      [stripe({ currentPeriodEnd: "2027-01-01T00:00:00.000Z" })],
      [local({ currentPeriodEnd: "2026-12-01T00:00:00.000Z" })],
    );
    expect(d?.tipo).toBe("periodo_diferente");
  });

  it("um sabe do cancelamento agendado e o outro não", () => {
    const [d] = reconcileSubscriptions([stripe({ cancelAtPeriodEnd: true })], [local()]);
    expect(d?.tipo).toBe("cancelamento_diferente");
  });
});

describe("o que NÃO é divergência — a metade que mantém o relatório vivo", () => {
  it("duas pontas de acordo não produzem nada", () => {
    expect(reconcileSubscriptions([stripe()], [local()])).toEqual([]);
  });

  it("segundos de diferença no fim do período são ruído, não divergência", () => {
    // O Stripe fecha o período e o webhook escreve alguns instantes depois.
    // Sem margem, metade do relatório era isto.
    const resultado = reconcileSubscriptions(
      [stripe({ currentPeriodEnd: "2026-12-01T00:00:00.000Z" })],
      [local({ currentPeriodEnd: "2026-12-01T00:04:12.000Z" })],
    );
    expect(resultado).toEqual([]);
  });

  it("uma subscrição cancelada que nunca existiu cá é história, não problema", () => {
    expect(reconcileSubscriptions([stripe({ status: "canceled" })], [])).toEqual([]);
  });

  it("uma linha sem `stripe_subscription_id` não é comparável — e não se inventa", () => {
    // Atribuição manual de admin por `profiles.plan_id` não passa pelo Stripe.
    const resultado = reconcileSubscriptions([], [local({ stripeSubscriptionId: null })]);
    expect(resultado).toEqual([]);
  });

  it("um desacordo de acesso não é contado duas vezes", () => {
    // `canceled` vs `active` já diz tudo; acrescentar "estado diferente" por
    // cima empurrava o que interessa para o fim da lista.
    const resultado = reconcileSubscriptions(
      [stripe({ status: "canceled" })],
      [local({ status: "active" })],
    );
    expect(resultado).toHaveLength(1);
  });

  it("listas vazias dos dois lados dão um relatório vazio", () => {
    expect(reconcileSubscriptions([], [])).toEqual([]);
  });
});
