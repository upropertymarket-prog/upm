/**
 * Ponte temporária para o schema da Fase 9 (P9-01 … P9-09)
 * =========================================================================
 * `database.types.ts` é gerado por `pnpm db:types` **contra o staging**, e as
 * migrações desta fase ainda não estão aplicadas lá. Até estarem, as funções e
 * as tabelas novas não existem nos tipos, e o `tsc` recusa-as.
 *
 * É o mesmo caminho que a Fase 8 seguiu com D50: os RPC novos entram por cast,
 * com o comentário a dizê-lo, e os casts saem na regeneração. A diferença é que
 * aqui ficam **num ficheiro só** — assim não há vinte casts espalhados a
 * encontrar por grep, há dois nomes a procurar.
 *
 * Como se apaga isto, depois de `supabase db push` + `pnpm db:types`:
 *
 *   1. `grep -rn "pendingRpc\|pendingSelectOne" apps packages`
 *   2. trocar cada chamada pela equivalente tipada (`supabase.rpc(...)`,
 *      `supabase.from(...).select(...)`)
 *   3. apagar este ficheiro e a entrada em `package.json#exports`
 *
 * Enquanto existir, é dívida registada no doc 10.
 */

export type PendingError = {
  code?: string | null;
  hint?: string | null;
  message?: string;
} | null;

export type PendingResult<T> = { data: T | null; error: PendingError };

type RpcCall<T> = (name: string, args: Record<string, unknown>) => Promise<PendingResult<T>>;

/** Um RPC que ainda não está nos tipos gerados. */
export async function pendingRpc<T = unknown>(
  client: { rpc: unknown },
  name: string,
  args: Record<string, unknown> = {},
): Promise<PendingResult<T>> {
  return (client.rpc as RpcCall<T>).call(client, name, args);
}

/**
 * Um RPC `returns table` de que só interessa a primeira linha. O cliente
 * Supabase devolve um array; `maybeSingle()` no builder faria o mesmo, mas
 * exigiria tipar o builder inteiro para nada.
 */
export async function pendingRpcRow<T = unknown>(
  client: { rpc: unknown },
  name: string,
  args: Record<string, unknown> = {},
): Promise<PendingResult<T>> {
  const { data, error } = await pendingRpc<T[] | T>(client, name, args);
  if (error) return { data: null, error };
  if (Array.isArray(data)) return { data: data[0] ?? null, error: null };
  return { data: (data as T) ?? null, error: null };
}

type QueryBuilder<T> = {
  select: (columns: string) => QueryBuilder<T>;
  eq: (column: string, value: unknown) => QueryBuilder<T>;
  maybeSingle: () => Promise<PendingResult<T>>;
};

type FromCall<T> = (table: string) => QueryBuilder<T>;

/** Uma linha de uma tabela que ainda não está nos tipos gerados. */
export async function pendingSelectOne<T = unknown>(
  client: { from: unknown },
  table: string,
  columns: string,
  filters: Record<string, unknown>,
): Promise<PendingResult<T>> {
  let query = (client.from as FromCall<T>).call(client, table).select(columns);
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  return query.maybeSingle();
}
