/**
 * O estado dos formulários públicos, num ficheiro sem servidor.
 *
 * Existe para o `PreRegistrationForm` poder importar o tipo sem arrastar
 * `actions.ts` — que usa `next/headers` e, com ele, torna o componente um
 * Server Component que o canvas não consegue renderizar. Foi o
 * `canvas_validate` que apanhou isto, com `server_component_import`.
 */
export type LeadFormState = {
  ok?: boolean;
  alreadyConfirmed?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
};
