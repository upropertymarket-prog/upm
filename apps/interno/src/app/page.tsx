import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@upm/db/server";

/**
 * A raiz de `interno` — encaminha cada papel para a sua área
 * =========================================================================
 * Três destinos desde P10-07, que é quando o Marketing passou a ser área
 * própria (07 §24.6). É também onde o middleware deixa cair quem tenta um
 * prefixo que não é o seu: a raiz leva cada um ao trabalho dele em vez de
 * mostrar uma parede.
 *
 * Cada área abre no ecrã que 03 §1.3 lhe dá como inicial: o Admin no Painel, o
 * Suporte na Caixa de e-mail, o Marketing nas Atualizações.
 */
export default async function InternalIndexPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  // Os dois `as never` são o que o `typedRoutes` obriga enquanto as rotas não
  // estiverem no mapa gerado — a mesma nota que está no `InternalChrome`, que
  // usa `<a>` em vez de `next/link` pela mesma razão.
  const role = profile?.role ?? null;
  if (role === "support") redirect("/suporte/email" as never);
  if (role === "marketing") redirect("/marketing/atualizacoes" as never);
  redirect("/admin/painel");
}
