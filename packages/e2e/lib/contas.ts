/**
 * Contas de teste dos E2E
 * =========================================================================
 * Cada teste cria as suas contas (`e2e-<papel>-<carimbo>@upropertymarket.test`)
 * e regista-as para apagar no fim. Nada fica partilhado entre testes: um
 * percurso que falha a meio não deixa um estado que faça falhar o seguinte.
 *
 * As contas nascem confirmadas (`email_confirm`) quando o teste não é sobre a
 * confirmação. Os que são — criar conta, recuperar palavra-passe — vão buscar
 * o link à API de administração (`generateLink`), que gera exatamente o link
 * que o e-mail levaria, sem depender de uma caixa de correio.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { ANON_KEY, SERVICE_KEY, SUPABASE_URL } from "./ambiente";

export type Papel = "buyer" | "owner" | "admin" | "support" | "marketing";

export const PALAVRA_PASSE = "E2e-teste-P@ss-2026";

let servico: SupabaseClient | null = null;
export function service(): SupabaseClient {
  servico ??= createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  return servico;
}

export function anon(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
}

const criadas: string[] = [];

export function emailDeTeste(papel: string): string {
  const carimbo = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return `e2e-${papel}-${carimbo}@upropertymarket.test`;
}

/**
 * Um endereço que o `signUp` público aceita, para os percursos que passam
 * pelo registo a sério.
 * ---------------------------------------------------------------------------
 * As contas criadas pela API de administração podem ser `.test`; o `signUp`
 * não: o Supabase recusa o domínio (`email_address_invalid`, visto a 3 nov —
 * e era isso, não o SMTP, que parava o percurso do registo). Usa-se o
 * endereço de teste do Resend, `delivered@resend.dev`, que tem MX e que o
 * Resend dá como entregue sem entregar a ninguém; o `+etiqueta` torna cada
 * corrida única.
 */
export function emailEntregavel(papel: string): string {
  const carimbo = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return `delivered+e2e-${papel}-${carimbo}@resend.dev`;
}

export type Conta = { id: string; email: string; papel: Papel };

/**
 * Cria uma conta confirmada, com o papel pedido. `email` à parte para os
 * percursos em que o Auth manda e-mail a essa conta (ver `emailEntregavel`).
 */
export async function criarConta(
  papel: Papel,
  nome = `E2E ${papel}`,
  email = emailDeTeste(papel),
): Promise<Conta> {
  const { data, error } = await service().auth.admin.createUser({
    email,
    password: PALAVRA_PASSE,
    email_confirm: true,
    user_metadata: { role: papel, full_name: nome },
  });
  if (error || !data.user) throw new Error(`Falha a criar ${email}: ${error?.message}`);
  criadas.push(data.user.id);
  return { id: data.user.id, email, papel };
}

/** Regista uma conta criada por outro caminho (o registo pelo site), para apagar no fim. */
export function registarParaApagar(id: string): void {
  criadas.push(id);
}

/**
 * Plano ativo, como o webhook do Stripe o deixaria a quem paga — o mesmo
 * expediente de `packages/db/src/test-plan-fixture.ts` (1 nov). Sem plano não
 * há imóveis, visitas, guardados nem alertas (P9-05).
 */
export async function darPlano(perfil: string, slug: "premium-buyer" | "premium-owner") {
  const { data: plano } = await service().from("plans").select("id").eq("slug", slug).single();
  if (!plano) throw new Error(`Plano em falta: ${slug}`);
  const { error } = await service()
    .from("subscriptions")
    .insert({ profile_id: perfil, plan_id: plano.id, status: "active" });
  if (error) throw new Error(`Falha a dar ${slug}: ${error.message}`);
}

/**
 * Apaga as contas criadas, e o que elas deixaram.
 * ---------------------------------------------------------------------------
 * A subscrição e o resto saem em cascata; o `audit_log` fica, com o autor a
 * null (A8). O que **não** sai em cascata é o histórico de moderação:
 * `property_moderation_events` prende o imóvel e o moderador (`restrict`), e
 * bem — em produção um imóvel nunca se apaga, arquiva-se, e esse histórico
 * não se perde. Aqui apaga-se primeiro, de propósito.
 *
 * Até 3 nov isto não verificava erros: o `delete` do imóvel moderado falhava
 * em silêncio, a conta também, e ficaram **10 anúncios "E2E Moradia" ativos
 * no site público**, encontrados pelo teste de carga. Agora uma limpeza que
 * falha diz que falhou.
 */
export async function apagarContas(): Promise<void> {
  const falhas: string[] = [];
  while (criadas.length) {
    const id = criadas.pop()!;
    const { data: imoveis } = await service().from("properties").select("id").eq("owner_id", id);
    const ids = (imoveis ?? []).map((i) => i.id as string);
    const passos: Array<[string, PromiseLike<{ error: { message: string } | null }>]> = [
      [
        "histórico de moderação do moderador",
        service().from("property_moderation_events").delete().eq("actor_id", id),
      ],
    ];
    if (ids.length) {
      passos.push([
        "histórico de moderação dos imóveis",
        service().from("property_moderation_events").delete().in("property_id", ids),
      ]);
    }
    for (const [o_que, pedido] of passos) {
      const { error } = await pedido;
      if (error) falhas.push(`${id} · ${o_que}: ${error.message}`);
    }
    const { error: erroImoveis } = await service().from("properties").delete().eq("owner_id", id);
    if (erroImoveis) falhas.push(`${id} · imóveis: ${erroImoveis.message}`);

    // Uma conta que assinou o contrato de adesão (o E2E da subscrição) não se
    // apaga: `subscription_agreements` é registo legal, protegido pela
    // retenção (A7), e prende a subscrição. Em produção é igual — a conta
    // anonimiza-se, não desaparece. Fica, sem imóveis, e diz-se.
    const { count: contratos } = await service()
      .from("subscription_agreements")
      .select("id, subscriptions!inner(profile_id)", { count: "exact", head: true })
      .eq("subscriptions.profile_id", id);
    if (contratos) {
      console.warn(
        `[e2e] a conta ${id} fica: tem ${contratos} contrato(s) de adesão (registo legal).`,
      );
      continue;
    }
    const { error: erroConta } = await service().auth.admin.deleteUser(id);
    if (erroConta) falhas.push(`${id} · conta: ${erroConta.message}`);
  }
  if (falhas.length) throw new Error(`A limpeza dos E2E deixou restos:\n${falhas.join("\n")}`);
}

/**
 * Um imóvel publicado, criado pela API em nome do proprietário — o estado de
 * um anúncio que já passou a moderação. Para os percursos que começam com um
 * imóvel no Market (a visita), e não com a publicação em si.
 */
export async function imovelPublicado(dono: string, titulo: string): Promise<string> {
  const { data, error } = await service()
    .from("properties")
    .insert({
      owner_id: dono,
      ref: `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: titulo,
      deal: "sale",
      status: "active",
      // Os valores que o passo de identificação do assistente valida: um
      // imóvel sem `condition` não grava, e o ecrã mostra "Novo" só por ser a
      // primeira opção da lista.
      property_type: "Apartamento",
      typology: "T2",
      condition: "Usado — bom estado",
      description: "Imóvel criado pelos testes E2E.",
      price_cents: 25_000_000,
      city: "Lisboa",
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`Falha a criar o imóvel: ${error?.message}`);
  return data.id as string;
}
