/**
 * O desenho do e-mail transacional vive em `supabase/functions/_shared/` desde
 * 7 nov 2026: a Edge Function `outbox`, que entrega a fila no pré-lançamento,
 * e este worker usam o mesmo ficheiro. Duas cópias do mesmo HTML divergiam à
 * primeira correção — e o e-mail que um visitante recebe dependia de quem o
 * entregou.
 */
export * from "../../../supabase/functions/_shared/notification-email.ts";
