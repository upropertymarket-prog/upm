/**
 * O estado da confirmação, num ficheiro sem servidor.
 *
 * Mesma razão do `lib/leadFormState.ts`: o painel é um Client Component e
 * importar o tipo de `actions.ts` arrastava `@upm/db/server` para dentro dele.
 *
 * Não tem mensagem de erro, só `failed` — o texto está nas mensagens de
 * `next-intl` e é o painel que o escolhe. Uma action que devolvesse a frase
 * pronta falava sempre a mesma língua, e esta página existe nas duas.
 */
export type ConfirmState = { ok?: boolean; failed?: boolean };
