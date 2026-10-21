export type { Database, Json, Tables, TablesInsert, TablesUpdate, Enums } from "./database.types";
/**
 * `Constants` são os valores de cada enum em array, gerados ao lado dos tipos.
 *
 * Exposto a 21 out 2026, ao fechar a D64. Enquanto as tabelas e os enums novos
 * não existiam no ficheiro gerado, os arrays estavam escritos à mão em
 * `pending-types.ts` (`MAIL_FOLDERS`, `EMAIL_EVENT_TYPES`) — e uma lista de
 * valores de enum escrita à mão é uma lista que fica atrás do Postgres sem
 * ninguém notar. Agora derivam-se daqui.
 */
export { Constants } from "./database.types";
export * from "./types";
