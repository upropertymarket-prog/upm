import type { SupabaseClient, User } from "@supabase/supabase-js";

/**
 * Todos os utilizadores do Auth, página a página — só para os testes
 * =========================================================================
 * `auth.admin.listUsers()` sem argumentos devolve **a primeira página, de
 * 50**. Os testes procuravam a sua conta fixa nessa página e, não a
 * encontrando, tentavam criá-la — "already registered" — a partir do dia em
 * que o projeto passou das 50 contas (2 nov 2026, com os E2E). Um
 * `perPage: 1000` só adiava o mesmo defeito: lista-se até ao fim.
 *
 * Devolve a mesma forma de `listUsers()`, para substituir sem mexer no resto.
 */
export async function listarTodosOsUtilizadores(
  service: SupabaseClient,
): Promise<{ data: { users: User[] }; error: Error | null }> {
  const users: User[] = [];
  const porPagina = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: porPagina });
    if (error) return { data: { users }, error };
    users.push(...data.users);
    if (data.users.length < porPagina) return { data: { users }, error: null };
  }
}
