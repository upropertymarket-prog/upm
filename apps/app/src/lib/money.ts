/**
 * Formatação de preços — `price_cents`/`rent_cents` são cêntimos (`bigint`),
 * nunca euros. Um único ponto de formatação evita divergências entre ecrãs.
 */
const currency = new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" });

export function formatCents(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  return currency.format(cents / 100);
}
