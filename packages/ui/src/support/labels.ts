import type { ReportProblemLabels } from "./ReportProblemModal";

/**
 * As etiquetas do modal de Reportar problema, a partir do tradutor da app.
 *
 * Existe para que as duas apps que têm o botão — `app` e `interno` — não
 * escrevam a mesma lista de dezoito chaves cada uma. A alternativa era
 * duplicá-la, e no dia em que uma chave mudasse de nome passaria a faltar numa
 * das apps e só lá se veria.
 *
 * `packages/ui` continua sem i18n: recebe o tradutor, não o importa. É a mesma
 * figura das `labels` do `AppShell`.
 */
export function reportProblemLabels(t: (key: string) => string): ReportProblemLabels {
  return {
    title: t("support.report.title"),
    subtitle: t("support.report.subtitle"),
    descriptionLabel: t("support.report.descriptionLabel"),
    descriptionHint: t("support.report.descriptionHint"),
    descriptionPlaceholder: t("support.report.descriptionPlaceholder"),
    attach: t("support.report.attach"),
    attachRemove: t("support.report.attachRemove"),
    technicalTitle: t("support.report.technicalTitle"),
    technicalNote: t("support.report.technicalNote"),
    submit: t("support.report.submit"),
    cancel: t("support.report.cancel"),
    sending: t("support.report.sending"),
    successTitle: t("support.report.successTitle"),
    successBody: t("support.report.successBody"),
    mergedBody: t("support.report.mergedBody"),
    close: t("support.report.close"),
    tooShort: t("support.report.tooShort"),
    fileTooLarge: t("support.report.fileTooLarge"),
    fileWrongType: t("support.report.fileWrongType"),
  };
}
