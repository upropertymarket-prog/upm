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
 * Apaga as contas criadas. A subscrição, os imóveis e o resto saem em
 * cascata; o `audit_log` fica, com o autor a null — é só de acrescentar (A8).
 */
export async function apagarContas(): Promise<void> {
  while (criadas.length) {
    const id = criadas.pop()!;
    await service().from("properties").delete().eq("owner_id", id);
    await service().auth.admin.deleteUser(id);
  }
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
