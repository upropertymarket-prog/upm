/**
 * Argumentos de RPC que aceitam NULL e o ficheiro gerado declara obrigatórios
 * ===========================================================================
 * Nasceu a 21 out 2026, ao fechar a D64 — e nasce **a assumir que é dívida**,
 * de uma forma mais pequena e mais honesta do que a que substituiu.
 *
 * ## O que o gerador perde
 *
 * O `supabase gen types` olha para a assinatura de uma função e marca um
 * parâmetro como opcional (`p_x?`) **quando ele tem `default` no SQL**. O que
 * ele não representa é a *nullability*: um `p_id uuid` sem `default` sai como
 * `p_id: string`, embora o Postgres aceite `NULL` ali com todo o gosto — e
 * várias das nossas funções contam com isso. `campaign_save` lê `p_id null`
 * como "cria uma campanha nova"; `app_update_save` lê `p_image_path null` como
 * "esta novidade não tem imagem".
 *
 * O resultado é um tipo **mais estrito do que a base de dados**. Passar `null`
 * está certo e não compila.
 *
 * ## Porque é que não se resolve do outro lado
 *
 * Três saídas, e porque nenhuma serve:
 *
 *  - **Dar `default null` aos parâmetros no SQL** tornava-os opcionais e o
 *    gerador passava a aceitar `undefined`. É a correção de raiz e fica
 *    anotada como tal — mas é uma migração que muda a assinatura de doze
 *    funções em produção, e as confirmações em produção ficam para o fim do
 *    projeto.
 *  - **Mandar `undefined`** não é a mesma coisa: o cliente **omite** o que vem
 *    `undefined`, e um parâmetro sem `default` omitido é um erro do Postgres,
 *    não um `NULL`. Compilava e rebentava em produção, que é a pior das trocas.
 *  - **Um `as never` em cada chamada** foi exatamente o que a D52 nos ensinou a
 *    não fazer: casts anónimos espalhados sobrevivem ao dia em que deixam de
 *    ser necessários, porque ninguém sabe onde estão.
 *
 * Fica então uma função com nome, num sítio só, a dizer em voz alta o que está
 * a acontecer. Procurar por `nullableArg` dá a lista completa do que falta
 * corrigir no SQL; e no dia em que os `default null` entrarem, o compilador
 * aponta cada chamada que deixou de precisar dela.
 */

/**
 * O valor, ou `NULL`, para um argumento de RPC que o Postgres aceita nulo e o
 * tipo gerado declara obrigatório.
 *
 * `undefined` conta como `null` à entrada: quem não preencheu um campo e quem
 * o apagou querem a mesma coisa desta função.
 */
export function nullableArg<T>(value: T | null | undefined): T {
  return (value ?? null) as T;
}
