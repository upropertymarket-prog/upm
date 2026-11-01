import type { EmailSignatureRow } from "../../../packages/db/src/signatures";

/**
 * Assinaturas — os dados das storyboards do editor (P10-06)
 * =========================================================================
 * **Uma assinatura para toda a empresa** (29 out 2026): a tabela tem no
 * máximo uma linha, e já não há caixas associadas nem lista.
 *
 * - **O HTML é o do modelo de partida** (`SIGNATURE_TEMPLATE`, copiado e não
 *   importado — ver a nota em `Signatures.tsx`).
 * - **Datas fixas.** Duas montagens da mesma storyboard têm de dar o mesmo pixel.
 */

const MODELO = `<table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.6;">
  <tr>
    <td style="padding-right: 24px; border-right: 1px solid #D4D4D4; vertical-align: middle;">
      <img class="upm-sig-logo-light" src="https://www.upropertymarket.pt/brand/assinatura-light.png" alt="UProperty Market" width="160" height="54" style="display: block; border: 0;">
      <div class="upm-sig-logo-dark" style="display: none; mso-hide: all; max-height: 0; overflow: hidden;">
        <img src="https://www.upropertymarket.pt/brand/assinatura-dark.png" alt="UProperty Market" width="160" height="54" style="display: block; border: 0;">
      </div>
    </td>
    <td style="padding-left: 24px; vertical-align: middle;">
      <p style="margin: 0 0 12px 0; font-weight: 600; font-size: 15px;">A Equipa UProperty Market</p>
      <table cellpadding="0" cellspacing="0" border="0" style="line-height: 1.6;">
        <tr>
          <td style="padding-bottom: 4px; color: #8A8A8A; font-size: 13px;">Tel:</td>
          <td style="padding-bottom: 4px; padding-left: 8px;">(+351) 939 732 637</td>
        </tr>
        <tr>
          <td style="padding-bottom: 4px; color: #8A8A8A; font-size: 13px;">Email:</td>
          <td style="padding-bottom: 4px; padding-left: 8px;"><a href="mailto:info@upropertymarket.pt" style="color: inherit; text-decoration: none;">info@upropertymarket.pt</a></td>
        </tr>
        <tr>
          <td style="color: #8A8A8A; font-size: 13px;">Web:</td>
          <td style="padding-left: 8px;"><a href="https://www.upropertymarket.pt" style="color: inherit; text-decoration: none;">www.upropertymarket.pt</a></td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

export const SIGNATURE: EmailSignatureRow = {
  id: "5a5a5a5a-1111-4111-8111-5a5a5a5a5a5a",
  name: "Assinatura da empresa",
  html: MODELO,
  created_at: "2026-10-14T10:00:00.000Z",
  updated_at: "2026-10-20T09:30:00.000Z",
};

/**
 * Os dados do dono da caixa, como `resolve_signature_variables()` os traria.
 * Na app é a base de dados que resolve (05 §1.8); aqui é só para a coluna da
 * pré-visualização mostrar uma pessoa e não as chavetas.
 */
export const VARIAVEIS_RESOLVIDAS: Record<string, string> = {
  nome: "Helena Matos",
  cargo: "Apoio ao cliente",
  departamento: "Suporte",
  email: "suporte@upropertymarket.pt",
  telefone: "+351 210 000 000",
  iniciais: "HM",
};

/** HTML colado com o que o sanitizador tira — o estado dos avisos. */
// Os avisos sem estragar o desenho: um `onclick` e um `<script>` não se veem, e
// a variável que não existe fica no lugar do telefone, onde se percebe porquê.
export const HTML_COM_AVISOS = MODELO.replace(
  '<a href="mailto:',
  '<a onclick="track()" href="mailto:',
)
  .replace("(+351) 939 732 637", "{{telemovel}}")
  .replace("</table>\n    </td>", "</table><script>track()</script>\n    </td>");
