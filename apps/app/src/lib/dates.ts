/**
 * O mês que o calendário da Agenda abre, como `YYYY-MM`.
 *
 * Fica numa função sua e não inline no componente por uma razão prática: um
 * componente que lê o relógio faz a storyboard flutuar no VRT. As storyboards
 * passam um mês fixo; só a página real chama isto.
 */
export function currentMonth(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
