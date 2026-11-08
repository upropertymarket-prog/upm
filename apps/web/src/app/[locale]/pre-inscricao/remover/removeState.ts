/**
 * O estado da remoção, num ficheiro sem servidor — a mesma razão do
 * `confirmar/confirmState.ts`: o painel é um Client Component, e importar o
 * tipo de `actions.ts` arrastava `@upm/db/server` para dentro dele.
 */
export type RemoveState = { ok?: boolean; failed?: boolean };
