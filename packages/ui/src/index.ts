/**
 * `@upm/ui` — design system partilhado pelas 3 apps (04 §5 · Fase 1)
 * =========================================================================
 * Importar a folha de estilo uma vez, no root layout de cada app:
 *
 *   import "@upm/ui/styles.css";
 *
 * As fontes auto-hospedadas vivem em `@upm/ui/fonts` e são importadas à parte,
 * porque `next/font/local` só pode ser chamado de um módulo que o Next compile.
 *
 * O catálogo visual são os canvases do Tempo em
 * `tempo/designs/canvases/design-system/**` — não há Storybook (07 §4.5).
 */

// Componentes base (P1-04)
export { Button } from "./components/Button";
export type { ButtonProps, ButtonSize, ButtonVariant } from "./components/Button";

export { Field } from "./components/Field";
export type { FieldProps } from "./components/Field";

export { Input, Textarea } from "./components/Input";
export type { InputProps, TextareaProps } from "./components/Input";

export { Select } from "./components/Select";
export type { SelectOption, SelectProps } from "./components/Select";

export { Tabs } from "./components/Tabs";
export type { TabItem, TabsProps } from "./components/Tabs";

export { Badge, STATUS_TONES, StatusTag } from "./components/StatusTag";
export type { BadgeProps, StatusTagProps, StatusTone } from "./components/StatusTag";

export { Card, CardBody, CardFooter, CardHeader, CardTitle } from "./components/Card";
export type { CardProps } from "./components/Card";

export { Table } from "./components/Table";
export type { TableColumn, TableProps } from "./components/Table";

export { Drawer, Modal } from "./components/Overlay";
export type { DrawerProps, ModalProps } from "./components/Overlay";

export { ReportProblemModal } from "./support/ReportProblemModal";
export type {
  ReportProblemLabels,
  ReportProblemModalProps,
  ReportProblemSubmit,
} from "./support/ReportProblemModal";
export { reportProblemLabels } from "./support/labels";

export { AppUpdatesModal, appUpdatesLabels } from "./support/AppUpdatesModal";
export type { AppUpdate, AppUpdatesLabels, AppUpdatesModalProps } from "./support/AppUpdatesModal";
export { captureTechnicalSnapshot, installBreadcrumbs } from "./support/breadcrumbs";
export type { Breadcrumb, TechnicalSnapshot } from "./support/breadcrumbs";

export { ToastProvider, useToast } from "./components/Toast";
export type { ToastTone } from "./components/Toast";

export { Toggle } from "./components/Toggle";
export type { ToggleProps } from "./components/Toggle";

export { Checkbox } from "./components/Checkbox";
export type { CheckboxProps } from "./components/Checkbox";

export { EmptyState } from "./components/EmptyState";
export type { EmptyStateProps } from "./components/EmptyState";

export { Pagination, paginationRange } from "./components/Pagination";
export type { PaginationProps } from "./components/Pagination";

// Esqueletos de carregamento — os `loading.tsx` de cada rota (19 nov 2026)
export {
  ShellSkeleton,
  Skeleton,
  SkeletonCard,
  SkeletonCards,
  SkeletonColumns,
  SkeletonField,
  SkeletonFilters,
  SkeletonForm,
  SkeletonHeader,
  SkeletonList,
  SkeletonPage,
  SkeletonSplit,
  SkeletonStats,
  SkeletonTable,
  SkeletonTabs,
} from "./components/Skeleton";
export type { SkeletonProps } from "./components/Skeleton";

// Tema (P1-03)
export { ThemeScript } from "./theme/ThemeScript";
export { ThemeProvider, useTheme } from "./theme/ThemeProvider";
export { ThemeToggle } from "./theme/ThemeToggle";
export type { ThemeToggleLabels } from "./theme/ThemeToggle";
export {
  THEME_ATTR,
  THEME_CHOICE_ATTR,
  THEME_CHOICES,
  THEME_STORAGE_KEY,
  isThemeChoice,
} from "./theme/theme";
export type { ResolvedTheme, ThemeChoice } from "./theme/theme";

// App shell (P1-05)
export { AppShell } from "./shell/AppShell";
export type { AppShellProps } from "./shell/AppShell";
export { Brand } from "./shell/Brand";
export type { BrandProps } from "./shell/Brand";
export { Sidebar } from "./shell/Sidebar";
export type { NavGroup, NavItem, SidebarLabels, SidebarProps, SidebarUser } from "./shell/Sidebar";
export { LanguageMenu } from "./shell/LanguageMenu";
export { Topbar } from "./shell/Topbar";
export type { LocaleOption, Notification, TopbarLabels, TopbarProps } from "./shell/Topbar";
export { PageHeader, greetingKey } from "./shell/PageHeader";
export type { PageHeaderProps } from "./shell/PageHeader";

// Utilitários
export { cx } from "./lib/cx";
export { useClickOutside, useDismissable } from "./lib/useDismissable";
