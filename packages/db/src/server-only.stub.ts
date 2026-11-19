/**
 * `server-only` para o Vitest
 * ===========================================================================
 * O pacote só fica vazio sob a condição `react-server`, que é a do Next nos
 * Server Components; em Node puro atira, de propósito. O Vitest corre em Node,
 * por isso os `vitest.config.ts` trocam-no por este ficheiro. A proteção
 * continua inteira onde interessa: no bundle do cliente, que é o Next que faz.
 */
export {};
