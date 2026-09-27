/**
 * Fontes — AUTO-HOSPEDADAS (P1-02)
 * =========================================================================
 * 04 §5.3: títulos em Bricolage Grotesque (600–700), texto e UI em Manrope
 * (400–800), código e referências em JetBrains Mono.
 *
 * Usa-se `next/font/local` e NUNCA `next/font/google`: nesta máquina o proxy
 * intercepta o TLS e o `next/font/google` falha o build ao ir buscar os
 * ficheiros a `fonts.gstatic.com` em tempo de compilação. Com ficheiros no
 * repositório o build é offline e determinístico — e o site deixa de fazer
 * pedidos a terceiros, o que também poupa uma dependência ao RGPD (07 §4.4).
 *
 * Os `.woff2` em `./files` são os cortes latin + latin-ext das fontes
 * variáveis, extraídos dos pacotes `@fontsource-variable/*` (SIL OFL 1.1 —
 * licenças em `./files/LICENSE-*.txt`). São ficheiros versionados: o pacote
 * npm é só a origem, não uma dependência de runtime.
 *
 * Cada fonte expõe uma CSS variable consumida por `tokens.css`
 * (`--font-display`, `--font-sans`, `--font-mono`).
 */
import localFont from "next/font/local";

/** Títulos — 600–700 (04 §5.3). */
export const bricolage = localFont({
  src: [
    { path: "./files/bricolage-grotesque-latin-wght-normal.woff2", style: "normal" },
    { path: "./files/bricolage-grotesque-latin-ext-wght-normal.woff2", style: "normal" },
  ],
  variable: "--font-bricolage",
  weight: "500 700",
  display: "swap",
  fallback: ["system-ui", "sans-serif"],
  preload: true,
});

/** Texto e UI — 400–800 (04 §5.3). */
export const manrope = localFont({
  src: [
    { path: "./files/manrope-latin-wght-normal.woff2", style: "normal" },
    { path: "./files/manrope-latin-ext-wght-normal.woff2", style: "normal" },
  ],
  variable: "--font-manrope",
  weight: "400 800",
  display: "swap",
  fallback: ["Helvetica Neue", "Helvetica", "sans-serif"],
  preload: true,
});

/** Código, referências e contadores — 400–500 (04 §5.3). */
export const jetbrainsMono = localFont({
  src: [
    { path: "./files/jetbrains-mono-latin-wght-normal.woff2", style: "normal" },
    { path: "./files/jetbrains-mono-latin-ext-wght-normal.woff2", style: "normal" },
  ],
  variable: "--font-jetbrains",
  weight: "400 500",
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
  preload: false,
});

/**
 * Classe a pôr no `<html>` de cada app. Declara as três variables de uma vez
 * para nenhuma app se esquecer de uma.
 */
export const fontVariables = [bricolage.variable, manrope.variable, jetbrainsMono.variable].join(
  " ",
);
