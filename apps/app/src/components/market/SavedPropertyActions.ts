/**
 * Tipos só — sem `"use server"` nem `"use client"`. O `SaveButton` (client
 * component) recebe a Server Action verdadeira por prop, nunca a importa
 * diretamente: um client component não pode importar `next/headers`
 * transitivamente, e este tipo é o contrato entre os dois lados.
 */
export type ToggleSavedResult = { saved: boolean } | { error: string };

export type ToggleSavedAction = (propertyId: string) => Promise<ToggleSavedResult>;
