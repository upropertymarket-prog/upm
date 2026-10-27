/**
 * `@upm/cloud` — o ecrã da Cloud, partilhado pela `app` e pelo `interno` (D71)
 * =========================================================================
 * Três rotas montam o que está aqui: `/cloud` na app, `/suporte/cloud` e
 * `/marketing/cloud` no acesso interno. O que muda entre elas são as props —
 * ver a nota de topo do `CloudScreen`.
 *
 * ## Porque é que não vive em `@upm/ui`
 *
 * Porque `@upm/ui` **não depende de `@upm/db`**, e é bom que assim seja — está
 * escrito e testado em `packages/ui/src/editor/VariableNode.test.ts`. Este
 * ecrã depende: `formatBytes`, `CloudStatus`, `SharePermission`,
 * `SHARE_EXPIRY_OPTIONS`. Levá-lo para o design system era levar o pacote da
 * base de dados atrás, ou duplicar quatro contratos e esperar que não
 * divergissem.
 *
 * O design system continua a ser o de sempre: este pacote **consome** `@upm/ui`
 * e não acrescenta um único componente base. A diferença é que usa `next-intl`
 * diretamente — pode, porque não é design system, e as mensagens já vivem num
 * catálogo partilhado (`@upm/config/messages`) que as duas apps leem.
 */

export { CloudScreen } from "./CloudScreen";
export type { CloudFileDetails, CloudScreenProps } from "./CloudScreen";

export { ShareFileModal } from "./ShareFileModal";
export type { ShareFileModalProps, ShareState } from "./ShareFileModal";

export {
  buildFolderTree,
  folderSubtreeIds,
  formatDate,
  mimeLabel,
  type CloudFileRow,
  type CloudWriteResult,
  type FileAccessRow,
  type FileVersionRow,
  type FolderKind,
  type FolderNode,
  type ShareContact,
  type SharedWithMeRow,
} from "./cloudTypes";
