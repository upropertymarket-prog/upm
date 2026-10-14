import type { RichTextLabels } from "./RichText";

/**
 * As etiquetas da barra, a partir do tradutor da app — a mesma figura de
 * `reportProblemLabels`. Vivem no namespace `editor.*` e não dentro do
 * Composer: a barra passou a ser de três ecrãs, e deixá-la em
 * `support.mailbox.composer.*` fazia as Campanhas pedir etiquetas ao correio.
 *
 * `packages/ui` continua sem i18n: recebe o tradutor, não o importa.
 */
export function richTextLabels(t: (key: never) => string): RichTextLabels {
  const translate = t as unknown as (key: string) => string;
  return {
    toolbar: translate("editor.toolbar"),
    bold: translate("editor.bold"),
    italic: translate("editor.italic"),
    underline: translate("editor.underline"),
    strike: translate("editor.strike"),
    bullets: translate("editor.bullets"),
    numbers: translate("editor.numbers"),
    quote: translate("editor.quote"),
    link: translate("editor.link"),
    linkPrompt: translate("editor.linkPrompt"),
    alignLeft: translate("editor.alignLeft"),
    alignCenter: translate("editor.alignCenter"),
    alignRight: translate("editor.alignRight"),
    undo: translate("editor.undo"),
    redo: translate("editor.redo"),
  };
}
