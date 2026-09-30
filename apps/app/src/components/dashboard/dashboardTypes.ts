/**
 * Tipos do Painel do proprietário (P4-06)
 * =========================================================================
 * O `page.tsx` resolve os números contra o Supabase e passa-os já prontos; os
 * componentes de apresentação não falam com a base de dados, para poderem ser
 * montados também no canvas de demonstração (`tempo/designs/canvases/
 * proprietario`) — o mesmo contrato do `PropertyListing` de P4-03.
 */

/** Tom da variação por baixo do número — nunca uma cor literal (04 §5.1). */
export type StatTone = "ok" | "warn" | "muted";

export type DashboardStat = {
  id: string;
  /** Nome do ícone `lucide-react` resolvido em `DashboardStats`. */
  icon: "building" | "eye" | "draft" | "saved" | "leads" | "visits";
  label: string;
  value: string;
  /** Linha de contexto: "+1 este mês", "a aguardar fotografias". */
  delta: string;
  deltaTone: StatTone;
};

/** Uma barra do gráfico de visitas. */
export type ViewsBucket = {
  /** Etiqueta do eixo: "seg", "s1", "set". */
  label: string;
  value: number;
  /** Etiqueta longa para leitores de ecrã e `title` do hover. */
  srLabel: string;
};

/** Um intervalo do seletor 7 dias / 30 dias / 12 meses. */
export type ViewsSeries = {
  id: string;
  label: string;
  buckets: ViewsBucket[];
};
