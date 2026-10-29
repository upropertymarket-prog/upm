import { THEME_ATTR, THEME_CHOICE_ATTR, THEME_STORAGE_KEY, type ThemeChoice } from "./theme";

/**
 * Script anti-flash (04 §5.2 · P1-03)
 * =========================================================================
 * Corre **no `<head>`, síncrono, antes do primeiro paint**, e escreve
 * `data-theme` no `<html>`. Sem ele há o clarão branco de um frame quando o
 * utilizador tem tema escuro — e num produto com `--bg #050A16` esse clarão é
 * bem visível.
 *
 * Tem de ser um `<script>` inline no `<head>`: um componente cliente normal só
 * corre depois da hidratação, tarde demais.
 *
 * Ordem de precedência:
 *  1. `serverChoice` — `profiles.theme`, conhecido no servidor. É a conta a
 *     mandar, para a escolha seguir o utilizador entre dispositivos.
 *  2. `localStorage` — cobre visitantes sem sessão e o site público.
 *  3. `system` — `prefers-color-scheme`, o comportamento de 1.º acesso.
 *
 * Nota de CSP (02 §7.3 / 08 §7.2): a CSP é estrita e sem `unsafe-inline`, logo
 * este script precisa do nonce do Next. Passa-se em `nonce` na Fase 3, quando
 * a CSP entrar (dívida D5 do doc 08).
 *
 * EXCEÇÃO DECLARADA a 08 §7.2 (`dangerouslySetInnerHTML` proibido salvo em
 * assinaturas de e-mail, blocos de campanha e corpo de contrato): é o único
 * modo de emitir um script inline em React. A string é construída **aqui**, em
 * tempo de compilação, a partir de constantes do próprio módulo; o único valor
 * interpolado é `serverChoice`, que passa por `JSON.stringify` e é validado
 * contra a lista `["light","dark","system"]` dentro do próprio script. Nenhum
 * input de utilizador chega a este ficheiro. A exceção fica registada no
 * relatório da Fase 1 (doc 08 §9) para entrar em 08 §7.2.
 */
export function ThemeScript({
  serverChoice,
  nonce,
}: {
  /** `profiles.theme` do utilizador com sessão, quando existe. */
  serverChoice?: ThemeChoice | null;
  nonce?: string;
}) {
  const server = serverChoice ?? "";

  // Minificado à mão e sem dependências: é o primeiro bytes-a-executar da
  // página e qualquer erro aqui deixa o documento sem tema.
  const script =
    `(function(){try{` +
    `var d=document.documentElement,` +
    `s=${JSON.stringify(server)},` +
    `l=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}),` +
    `v=["light","dark","system"],` +
    `c=v.indexOf(s)>-1?s:(v.indexOf(l)>-1?l:"system"),` +
    `r=c==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):c;` +
    `d.setAttribute(${JSON.stringify(THEME_ATTR)},r);` +
    `d.setAttribute(${JSON.stringify(THEME_CHOICE_ATTR)},c);` +
    `}catch(e){document.documentElement.setAttribute(${JSON.stringify(THEME_ATTR)},"light");}})();`;

  // html-ok: o `script` é construído aqui em cima, linha a linha, e tudo o que
  // nele vem de fora passa por `JSON.stringify`. Não há entrada de utilizador
  // neste caminho; corre sob a CSP pelo `nonce` do pedido.
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: script }} />;
}
