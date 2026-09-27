/**
 * Tema — contrato partilhado (P1-03)
 * =========================================================================
 * 04 §5.2: 1.º acesso respeita `prefers-color-scheme`; depois vale a escolha
 * persistida em `localStorage` **e** em `profiles.theme`. Opções: Claro,
 * Escuro, Sistema.
 *
 * Distinguem-se dois conceitos, e a confusão entre eles é a origem habitual
 * dos bugs de tema:
 *  - **escolha** (`ThemeChoice`): o que o utilizador selecionou — pode ser
 *    `system`. É o que se persiste.
 *  - **tema resolvido** (`ResolvedTheme`): `light` ou `dark`. É o que vai para
 *    o atributo `data-theme` e o que a CSS lê.
 */

export const THEME_CHOICES = ["light", "dark", "system"] as const;
export type ThemeChoice = (typeof THEME_CHOICES)[number];

export type ResolvedTheme = "light" | "dark";

/** Chave em `localStorage`. Igual à dos protótipos, para não perder escolhas. */
export const THEME_STORAGE_KEY = "upm-theme";

/** Atributo lido pela CSS em `tokens.css`. */
export const THEME_ATTR = "data-theme";

/** Atributo com a escolha (inclui `system`), para a UI marcar o item ativo. */
export const THEME_CHOICE_ATTR = "data-theme-choice";

export function isThemeChoice(value: unknown): value is ThemeChoice {
  return typeof value === "string" && (THEME_CHOICES as readonly string[]).includes(value);
}
