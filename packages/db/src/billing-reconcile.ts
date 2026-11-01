import { ENTITLED_STATUSES, type SubscriptionStatus } from "./billing";

/**
 * Conciliação entre o Stripe e o Postgres (12 §7.2)
 * ===========================================================================
 * O estado de uma subscrição aqui vive de **eventos**: o Stripe envia, o
 * webhook escreve. É o desenho certo e tem uma falha conhecida — um evento que
 * não chega deixa as duas pontas a discordar, **em silêncio**. Não há erro,
 * não há alerta: há uma pessoa que pagou e não entra, ou uma que cancelou e
 * continua a entrar.
 *
 * O webhook já se protege do que consegue: assinatura verificada, idempotência
 * por `event.id`, e uma linha em `stripe_events` que fica em `failed` com a
 * razão. Mas isso só cobre os eventos que **chegaram**. O que ninguém vê é o
 * que nunca chegou — uma indisponibilidade de 24 h nossa, um reenvio que
 * esgotou as tentativas, uma alteração feita à mão no painel do Stripe.
 *
 * A única forma de apanhar isso é perguntar às duas pontas e comparar. É o que
 * esta função faz, e **não corrige nada**: produz a lista. Corrigir
 * automaticamente uma divergência de faturação é como corrigir
 * automaticamente um extrato bancário — o que se quer é que alguém olhe.
 *
 * ## Porque é que é uma função pura
 *
 * Recebe as duas listas já lidas. Assim testa-se o que interessa — a regra de
 * comparação — sem chaves do Stripe, sem base de dados e sem rede. Quem vai
 * buscar os dados é `scripts/stripe/reconcile.ts`.
 */

/** O que o Stripe diz, reduzido ao que importa comparar. */
export type SubscricaoStripe = {
  stripeSubscriptionId: string;
  /** O e-mail do cliente, só para o relatório ser legível por um humano. */
  customerEmail?: string | null;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

/** O que o Postgres diz. */
export type SubscricaoLocal = {
  stripeSubscriptionId: string | null;
  profileId: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
};

export const TIPOS_DE_DIVERGENCIA = [
  /** Paga e não entra. O pior para quem está do outro lado. */
  "paga_sem_acesso",
  /** Cancelou e continua a entrar. Receita a escorrer. */
  "acesso_sem_pagar",
  /** Os dois concordam que há subscrição, mas não no estado dela. */
  "estado_diferente",
  /** O Stripe tem-na e nós nunca soubemos — o evento nunca chegou. */
  "ausente_no_postgres",
  /** Nós temos uma linha que o Stripe não conhece. */
  "ausente_no_stripe",
  /** O fim do período divergiu: a renovação pode não ter sido registada. */
  "periodo_diferente",
  /** Um cancelou no fim do período e o outro não sabe. */
  "cancelamento_diferente",
] as const;

export type TipoDeDivergencia = (typeof TIPOS_DE_DIVERGENCIA)[number];

export type Divergencia = {
  tipo: TipoDeDivergencia;
  stripeSubscriptionId: string;
  profileId: string | null;
  customerEmail: string | null;
  /**
   * O valor de cada lado, ou `null` quando esse lado não tem a subscrição.
   *
   * `null` e não um `"(sem linha)"`: o registo é dados, e como se mostra "não
   * existe" a um humano é decisão de quem o formata — aqui é uma consola,
   * amanhã pode ser um ecrã do Admin, e os dois escrevem-no de maneira
   * diferente.
   */
  stripe: string | null;
  postgres: string | null;
  /** `true` quando alguém perde ou ganha acesso indevidamente. */
  afetaAcesso: boolean;
};

const temAcesso = (status: SubscriptionStatus) => ENTITLED_STATUSES.includes(status);

/**
 * Duas datas são "a mesma" com um dia de folga.
 *
 * Sem folga, metade do relatório seriam diferenças de segundos entre o momento
 * em que o Stripe fecha o período e o momento em que o webhook escreve — ruído
 * que esconde o que interessa. Um dia é generoso de propósito: uma renovação
 * que falhou atrasa-se semanas, não horas.
 */
const MARGEM_MS = 24 * 60 * 60 * 1000;

function periodosDiferem(a: string | null, b: string | null): boolean {
  if (a === null && b === null) return false;
  if (a === null || b === null) return true;
  const ta = Date.parse(a);
  const tb = Date.parse(b);
  if (Number.isNaN(ta) || Number.isNaN(tb)) return true;
  return Math.abs(ta - tb) > MARGEM_MS;
}

export function reconcileSubscriptions(
  doStripe: readonly SubscricaoStripe[],
  doPostgres: readonly SubscricaoLocal[],
): Divergencia[] {
  const divergencias: Divergencia[] = [];

  const porId = new Map<string, SubscricaoLocal>();
  for (const local of doPostgres) {
    if (local.stripeSubscriptionId) porId.set(local.stripeSubscriptionId, local);
  }

  const vistos = new Set<string>();

  for (const remota of doStripe) {
    const local = porId.get(remota.stripeSubscriptionId);
    vistos.add(remota.stripeSubscriptionId);

    const base = {
      stripeSubscriptionId: remota.stripeSubscriptionId,
      customerEmail: remota.customerEmail ?? null,
    };

    if (!local) {
      // Só conta como divergência se o Stripe acha que esta subscrição vale
      // alguma coisa: uma subscrição cancelada há dois anos que nunca
      // existiu cá não é um problema, é história.
      if (temAcesso(remota.status)) {
        divergencias.push({
          ...base,
          tipo: "ausente_no_postgres",
          profileId: null,
          stripe: remota.status,
          postgres: null,
          afetaAcesso: true,
        });
      }
      continue;
    }

    const acessoStripe = temAcesso(remota.status);
    const acessoLocal = temAcesso(local.status);

    if (acessoStripe !== acessoLocal) {
      divergencias.push({
        ...base,
        tipo: acessoStripe ? "paga_sem_acesso" : "acesso_sem_pagar",
        profileId: local.profileId,
        stripe: remota.status,
        postgres: local.status,
        afetaAcesso: true,
      });
      // Um desacordo de acesso já contém o desacordo de estado; relatar os
      // dois era contar a mesma coisa duas vezes e empurrar o que interessa
      // para o fim da lista.
      continue;
    }

    if (remota.status !== local.status) {
      divergencias.push({
        ...base,
        tipo: "estado_diferente",
        profileId: local.profileId,
        stripe: remota.status,
        postgres: local.status,
        afetaAcesso: false,
      });
    }

    if (periodosDiferem(remota.currentPeriodEnd, local.currentPeriodEnd)) {
      divergencias.push({
        ...base,
        tipo: "periodo_diferente",
        profileId: local.profileId,
        stripe: remota.currentPeriodEnd,
        postgres: local.currentPeriodEnd,
        afetaAcesso: false,
      });
    }

    if (remota.cancelAtPeriodEnd !== local.cancelAtPeriodEnd) {
      divergencias.push({
        ...base,
        tipo: "cancelamento_diferente",
        profileId: local.profileId,
        stripe: String(remota.cancelAtPeriodEnd),
        postgres: String(local.cancelAtPeriodEnd),
        // Não tira o acesso hoje, mas tira-o no fim do período — e descobrir
        // isso no dia é tarde para quem queria continuar.
        afetaAcesso: false,
      });
    }
  }

  for (const local of doPostgres) {
    if (!local.stripeSubscriptionId) continue;
    if (vistos.has(local.stripeSubscriptionId)) continue;
    // Uma linha nossa que o Stripe não conhece. Se ainda dá acesso, está a dar
    // acesso a troco de nada.
    divergencias.push({
      tipo: "ausente_no_stripe",
      stripeSubscriptionId: local.stripeSubscriptionId,
      profileId: local.profileId,
      customerEmail: null,
      stripe: null,
      postgres: local.status,
      afetaAcesso: temAcesso(local.status),
    });
  }

  // As que mexem com acesso primeiro: um relatório lê-se de cima, e o que está
  // em baixo é o que ninguém vê.
  return divergencias.sort((a, b) => Number(b.afetaAcesso) - Number(a.afetaAcesso));
}
