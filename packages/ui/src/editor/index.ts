/**
 * `@upm/ui/editor` — o editor de texto rico, num ponto de entrada próprio.
 *
 * Separado do barril de `@upm/ui` de propósito: o site público importa o design
 * system e nunca vai ter um editor. Ver a nota de topo de `RichText.tsx`.
 */
export { RichText, RICH_TEXT_PROSE } from "./RichText";
export type { RichTextFeature, RichTextLabels, RichTextProps } from "./RichText";
export { richTextLabels } from "./labels";
export { Variable } from "./VariableNode";
export type { EditorVariable } from "./VariableNode";
