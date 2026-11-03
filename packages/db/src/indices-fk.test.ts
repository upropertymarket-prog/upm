/**
 * Toda a chave estrangeira tem índice (12 §31, 4 nov 2026)
 * =========================================================================
 * Uma FK sem índice lê a tabela filha inteira quando se filtra por ela e cada
 * vez que a linha-mãe se apaga. Com as tabelas pequenas não se nota; com
 * dados, é a consulta lenta que ninguém escreveu. Havia 34, indexadas na
 * migração `20261104090000`. Uma FK nova sem índice parte este teste, com o
 * nome da coluna na mensagem.
 */
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

describe.skipIf(!SUPABASE_URL || !SERVICE_ROLE_KEY)("chaves estrangeiras — contra staging", () => {
  it("nenhuma FK sem índice", async () => {
    const service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    const { data, error } = await service.rpc("unindexed_foreign_keys");
    expect(error).toBeNull();
    const faltam = ((data ?? []) as { table_name: string; column_name: string }[]).map(
      (f) => `${f.table_name}.${f.column_name}`,
    );
    expect(faltam, "FK sem índice — cria-o na mesma migração que cria a FK").toEqual([]);
  });
});
