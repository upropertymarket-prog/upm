/**
 * Narração de canvas — dados de demonstração do canvas do Proprietário.
 *
 * Valores fixos de propósito: o `buildViewsSeries` da app lê o relógio, e uma
 * storyboard que renderiza diferente a cada montagem flutua no VRT.
 */
import type {
  DashboardStat,
  ViewsSeries,
} from "../../../../apps/app/src/components/dashboard/dashboardTypes";

export const demoLocaleChange = () => undefined;

export const demoDashboardStats: DashboardStat[] = [
  {
    id: "active",
    icon: "building",
    label: "Imóveis ativos",
    value: "4",
    delta: "5 no total",
    deltaTone: "muted",
  },
  {
    id: "views",
    icon: "eye",
    label: "Visitas às propriedades",
    value: "1 245",
    delta: "+12% esta semana",
    deltaTone: "ok",
  },
  {
    id: "saved",
    icon: "saved",
    label: "Guardados por compradores",
    value: "17",
    delta: "em listas de compradores",
    deltaTone: "ok",
  },
  {
    id: "drafts",
    icon: "draft",
    label: "Rascunhos",
    value: "1",
    delta: "a aguardar para publicar",
    deltaTone: "warn",
  },
];

export const demoViewsSeries: ViewsSeries[] = [
  {
    id: "7d",
    label: "7 dias",
    buckets: [
      { label: "qua", value: 142, srLabel: "23 de setembro" },
      { label: "qui", value: 186, srLabel: "24 de setembro" },
      { label: "sex", value: 164, srLabel: "25 de setembro" },
      { label: "sáb", value: 238, srLabel: "26 de setembro" },
      { label: "dom", value: 205, srLabel: "27 de setembro" },
      { label: "seg", value: 119, srLabel: "28 de setembro" },
      { label: "ter", value: 191, srLabel: "29 de setembro" },
    ],
  },
  {
    id: "30d",
    label: "30 dias",
    buckets: [
      { label: "s1", value: 780, srLabel: "Semana de 2 a 8 de setembro" },
      { label: "s2", value: 910, srLabel: "Semana de 9 a 15 de setembro" },
      { label: "s3", value: 1045, srLabel: "Semana de 16 a 22 de setembro" },
      { label: "s4", value: 1245, srLabel: "Semana de 23 a 29 de setembro" },
    ],
  },
  {
    id: "12m",
    label: "12 meses",
    buckets: [
      { label: "out", value: 1420, srLabel: "outubro de 2025" },
      { label: "nov", value: 1180, srLabel: "novembro de 2025" },
      { label: "dez", value: 940, srLabel: "dezembro de 2025" },
      { label: "jan", value: 1310, srLabel: "janeiro de 2026" },
      { label: "fev", value: 1495, srLabel: "fevereiro de 2026" },
      { label: "mar", value: 1860, srLabel: "março de 2026" },
      { label: "abr", value: 2100, srLabel: "abril de 2026" },
      { label: "mai", value: 2480, srLabel: "maio de 2026" },
      { label: "jun", value: 3010, srLabel: "junho de 2026" },
      { label: "jul", value: 3620, srLabel: "julho de 2026" },
      { label: "ago", value: 3180, srLabel: "agosto de 2026" },
      { label: "set", value: 4120, srLabel: "setembro de 2026" },
    ],
  },
];
