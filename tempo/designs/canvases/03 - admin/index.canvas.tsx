import { Canvas, Storyboard } from "tempo-sdk/canvas";
import {
  AdminDashboardClaro,
  AdminDashboardEscuro,
  AdminModeracaoClaro,
  AdminModeracaoEscuro,
  AdminModeracaoDrawerClaro,
  AdminModeracaoDrawerEscuro,
  AdminLeadsClaro,
  AdminLeadsEscuro,
  AdminLeadDrawerClaro,
  AdminLeadDrawerEscuro,
  AdminDefinicoesClaro,
  AdminDefinicoesEscuro,
} from "./Phase8";
import {
  AdminUtilizadoresClaro,
  AdminUtilizadoresEscuro,
  AdminUtilizadorDrawerClaro,
  AdminUtilizadorDrawerEscuro,
} from "./Users";
import {
  AdminTrafegoClaro,
  AdminTrafegoEscuro,
  AdminTrafegoVazio,
  AdminTrafegoVazioEscuro,
} from "./Traffic";
import { AdminPlanosClaro, AdminPlanosEscuro } from "./Billing";
import { AdminContratosClaro, AdminContratosEscuro } from "./Demo";
import { AdminStepUpClaro, AdminStepUpEscuro } from "./StepUp";
import { AdminSeoClaro, AdminSeoEscuro } from "./Seo";
import {
  AdminCaixasEmailClaro,
  AdminCaixasEmailEscuro,
  AdminCaixasEmailVazio,
  AdminCaixasEmailVazioEscuro,
} from "./Mailboxes";
import { AdminTicketsClaro, AdminTicketsEscuro } from "./Tickets";
import {
  AdminCaixaEmailClaro,
  AdminCaixaEmailEscuro,
  AdminCaixaEmailSemCaixas,
  AdminCaixaEmailSemCaixasEscuro,
} from "./Email";

/**
 * Canvas do Admin — pela ordem do menu
 * =========================================================================
 * **A ordem vertical das storyboards segue `ADMIN_NAV`**
 * (`apps/interno/src/lib/navigation.ts`), de cima para baixo: Painel,
 * Utilizadores, Moderação de imóveis, Tráfego, Planos, Templates de contrato,
 * Leads do site, SEO, Definições. Quem revê o canvas percorre-o na mesma ordem
 * em que percorre a aplicação, e uma storyboard fora do sítio passa a ler-se
 * como um erro — que é o que é. **Ao acrescentar uma entrada ao menu, a
 * storyboard entra na posição correspondente**, não no fim.
 *
 * Claro à esquerda (x = 0), escuro à direita (x = 1520), e os detalhes (os
 * drawers) logo por baixo da lista a que pertencem.
 *
 * Desde 13 out 2026 **todas as entradas do menu têm storyboard**: as últimas
 * duas que faltavam eram as Caixas de e-mail (`/admin/caixas-email`) e os
 * Tickets (`/admin/tickets`, vista só de leitura).
 *
 * A 27 out 2026 entrou a **Caixa de e-mail** (`/admin/email`), e entrou no sítio
 * que o menu lhe dá: *antes* da Configuração de e-mail, porque `ADMIN_NAV` tem
 * `mailbox` antes de `mailboxes` — lê-se "a caixa, e as caixas que a servem".
 * Pôr a storyboard no fim, por ser a mais recente, era desalinhá-la do menu.
 *
 * **Fica a faltar uma:** a Cloud interna (`/admin/cloud`), a terceira porta da
 * Cloud da equipa, entre a Configuração de e-mail e as Definições.
 *
 * A Confirmação de PIN fica no fim de propósito: não é uma entrada do menu, é
 * um diálogo transversal às ações sensíveis de várias páginas.
 */
export default function AdminCanvas() {
  return (
    <Canvas name="03 - admin" backgroundColor="#232323">
      {/* Painel */}
      <Storyboard
        id="AdminDashboardClaro"
        name="Painel do Admin · Claro"
        component={AdminDashboardClaro}
        layout={{ x: 0, y: 0, width: 1440, height: 1120 }}
      />
      <Storyboard
        id="AdminDashboardEscuro"
        name="Painel do Admin · Escuro"
        component={AdminDashboardEscuro}
        layout={{ x: 1520, y: 0, width: 1440, height: 1120 }}
      />

      {/* Utilizadores */}
      <Storyboard
        id="AdminUtilizadoresClaro"
        name="Utilizadores · Claro (/admin/utilizadores)"
        component={AdminUtilizadoresClaro}
        layout={{ x: 0, y: 1200, width: 1440, height: 1050 }}
      />
      <Storyboard
        id="AdminUtilizadoresEscuro"
        name="Utilizadores · Escuro (/admin/utilizadores)"
        component={AdminUtilizadoresEscuro}
        layout={{ x: 1520, y: 1200, width: 1440, height: 1050 }}
      />
      <Storyboard
        id="AdminUtilizadorDrawerClaro"
        name="Detalhe do utilizador · Claro"
        component={AdminUtilizadorDrawerClaro}
        layout={{ x: 0, y: 2330, width: 1440, height: 1050 }}
      />
      <Storyboard
        id="AdminUtilizadorDrawerEscuro"
        name="Detalhe do utilizador · Escuro"
        component={AdminUtilizadorDrawerEscuro}
        layout={{ x: 1520, y: 2330, width: 1440, height: 1050 }}
      />

      {/* Moderação de imóveis */}
      <Storyboard
        id="AdminModeracaoClaro"
        name="Moderação de imóveis · Claro"
        component={AdminModeracaoClaro}
        layout={{ x: 0, y: 3460, width: 1440, height: 1050 }}
      />
      <Storyboard
        id="AdminModeracaoEscuro"
        name="Moderação de imóveis · Escuro"
        component={AdminModeracaoEscuro}
        layout={{ x: 1520, y: 3460, width: 1440, height: 1050 }}
      />
      <Storyboard
        id="AdminModeracaoDrawerClaro"
        name="Detalhe e decisão de moderação · Claro"
        component={AdminModeracaoDrawerClaro}
        layout={{ x: 0, y: 4590, width: 1440, height: 1050 }}
      />
      <Storyboard
        id="AdminModeracaoDrawerEscuro"
        name="Detalhe e decisão de moderação · Escuro"
        component={AdminModeracaoDrawerEscuro}
        layout={{ x: 1520, y: 4590, width: 1440, height: 1050 }}
      />

      {/* Tráfego do site */}
      <Storyboard
        id="AdminTrafegoClaro"
        name="Tráfego do site · Claro (/admin/trafego)"
        component={AdminTrafegoClaro}
        layout={{ x: 0, y: 5720, width: 1440, height: 1100 }}
      />
      <Storyboard
        id="AdminTrafegoEscuro"
        name="Tráfego do site · Escuro (/admin/trafego)"
        component={AdminTrafegoEscuro}
        layout={{ x: 1520, y: 5720, width: 1440, height: 1100 }}
      />
      <Storyboard
        id="AdminTrafegoVazio"
        name="Tráfego do site · Estado vazio"
        component={AdminTrafegoVazio}
        layout={{ x: 0, y: 6900, width: 1440, height: 900 }}
      />
      <Storyboard
        id="AdminTrafegoVazioEscuro"
        name="Tráfego do site · Estado vazio · Escuro"
        component={AdminTrafegoVazioEscuro}
        layout={{ x: 1520, y: 6900, width: 1440, height: 900 }}
      />

      {/* Planos */}
      <Storyboard
        id="AdminPlanosClaro"
        name="Planos · Claro (/admin/planos)"
        component={AdminPlanosClaro}
        layout={{ x: 0, y: 7880, width: 1440, height: 900 }}
      />
      <Storyboard
        id="AdminPlanosEscuro"
        name="Planos · Escuro (/admin/planos)"
        component={AdminPlanosEscuro}
        layout={{ x: 1520, y: 7880, width: 1440, height: 900 }}
      />

      {/* Templates de contrato */}
      <Storyboard
        id="AdminContratosClaro"
        name="Templates de contrato · Claro"
        component={AdminContratosClaro}
        layout={{ x: 0, y: 8860, width: 1440, height: 900 }}
      />
      <Storyboard
        id="AdminContratosEscuro"
        name="Templates de contrato · Escuro"
        component={AdminContratosEscuro}
        layout={{ x: 1520, y: 8860, width: 1440, height: 900 }}
      />

      {/* Leads do site */}
      <Storyboard
        id="AdminLeadsClaro"
        name="Leads do site · Claro"
        component={AdminLeadsClaro}
        layout={{ x: 0, y: 9840, width: 1440, height: 1080 }}
      />
      <Storyboard
        id="AdminLeadsEscuro"
        name="Leads do site · Escuro"
        component={AdminLeadsEscuro}
        layout={{ x: 1520, y: 9840, width: 1440, height: 1080 }}
      />
      <Storyboard
        id="AdminLeadDrawerClaro"
        name="Detalhe da lead · Claro"
        component={AdminLeadDrawerClaro}
        layout={{ x: 0, y: 11000, width: 1440, height: 1080 }}
      />
      <Storyboard
        id="AdminLeadDrawerEscuro"
        name="Detalhe da lead · Escuro"
        component={AdminLeadDrawerEscuro}
        layout={{ x: 1520, y: 11000, width: 1440, height: 1080 }}
      />

      {/* Gestor de SEO (P2-06). A storyboard "SEO Manager" de 04 §2.1.1,
          traduzida para a convenção deste repositório pela decisão de 7 out
          2026: o componente real do Admin, não um editor próprio. */}
      <Storyboard
        id="AdminSeoClaro"
        name="SEO e Open Graph · Claro (/admin/seo)"
        component={AdminSeoClaro}
        layout={{ x: 0, y: 12160, width: 1440, height: 1150 }}
      />
      <Storyboard
        id="AdminSeoEscuro"
        name="SEO e Open Graph · Escuro (/admin/seo)"
        component={AdminSeoEscuro}
        layout={{ x: 1520, y: 12160, width: 1440, height: 1150 }}
      />

      {/* Tickets (P10-02), vista só de leitura. Entra entre o SEO e as Caixas
          de e-mail porque é essa a posição no menu do Admin — `navigation.ts`
          tem `seo`, `tickets`, `mailboxes`, `settings`, e o canvas percorre-se
          como se percorre a app. O workflow está em `canvases/suporte`; o que
          esta storyboard mostra é o mesmo componente sem os controlos. */}
      <Storyboard
        id="AdminTicketsClaro"
        name="Tickets · Só leitura · Claro (/admin/tickets)"
        component={AdminTicketsClaro}
        layout={{ x: 0, y: 13390, width: 1440, height: 1000 }}
      />
      <Storyboard
        id="AdminTicketsEscuro"
        name="Tickets · Só leitura · Escuro (/admin/tickets)"
        component={AdminTicketsEscuro}
        layout={{ x: 1520, y: 13390, width: 1440, height: 1000 }}
      />

      {/* Caixa de e-mail (26 out 2026). Entra entre os Tickets e a Configuração
          de e-mail porque é essa a posição no menu: `ADMIN_NAV` tem `tickets`,
          `mailbox`, `mailboxes`. É o `MailboxView` do Suporte sem o
          `onCreateTicket` — ver a nota de `Email.tsx`. */}
      <Storyboard
        id="AdminCaixaEmailClaro"
        name="Caixa de e-mail · Claro (/admin/email)"
        component={AdminCaixaEmailClaro}
        layout={{ x: 0, y: 14470, width: 1440, height: 1000 }}
      />
      <Storyboard
        id="AdminCaixaEmailEscuro"
        name="Caixa de e-mail · Escuro (/admin/email)"
        component={AdminCaixaEmailEscuro}
        layout={{ x: 1520, y: 14470, width: 1440, height: 1000 }}
      />

      {/* O estado real de hoje: nenhuma caixa criada na Amen. No Admin este
          vazio vale mais do que em qualquer outro papel — a Configuração que ele
          manda consultar é a entrada seguinte do seu próprio menu. */}
      <Storyboard
        id="AdminCaixaEmailSemCaixas"
        name="Caixa de e-mail · Sem caixas configuradas · Claro"
        component={AdminCaixaEmailSemCaixas}
        layout={{ x: 0, y: 15550, width: 1440, height: 700 }}
      />
      <Storyboard
        id="AdminCaixaEmailSemCaixasEscuro"
        name="Caixa de e-mail · Sem caixas configuradas · Escuro"
        component={AdminCaixaEmailSemCaixasEscuro}
        layout={{ x: 1520, y: 15550, width: 1440, height: 700 }}
      />

      {/* Configuração de e-mail (P10-03) */}
      <Storyboard
        id="AdminCaixasEmailClaro"
        name="Configuração de e-mail · Claro (/admin/caixas-email)"
        component={AdminCaixasEmailClaro}
        layout={{ x: 0, y: 16330, width: 1440, height: 1150 }}
      />
      <Storyboard
        id="AdminCaixasEmailEscuro"
        name="Configuração de e-mail · Escuro (/admin/caixas-email)"
        component={AdminCaixasEmailEscuro}
        layout={{ x: 1520, y: 16330, width: 1440, height: 1150 }}
      />

      {/* O estado que hoje é o único real: nenhuma caixa criada ainda. É o ecrã
          que recebe quem volta a isto depois de as criar na Amen. */}
      <Storyboard
        id="AdminCaixasEmailVazio"
        name="Configuração de e-mail · Sem caixas · Claro"
        component={AdminCaixasEmailVazio}
        layout={{ x: 0, y: 17560, width: 1440, height: 900 }}
      />
      <Storyboard
        id="AdminCaixasEmailVazioEscuro"
        name="Configuração de e-mail · Sem caixas · Escuro"
        component={AdminCaixasEmailVazioEscuro}
        layout={{ x: 1520, y: 17560, width: 1440, height: 900 }}
      />

      {/* Definições */}
      <Storyboard
        id="AdminDefinicoesClaro"
        name="Definições · Claro"
        component={AdminDefinicoesClaro}
        layout={{ x: 0, y: 18540, width: 1440, height: 1150 }}
      />
      <Storyboard
        id="AdminDefinicoesEscuro"
        name="Definições · Escuro"
        component={AdminDefinicoesEscuro}
        layout={{ x: 1520, y: 18540, width: 1440, height: 1150 }}
      />

      {/* Diálogo transversal às ações sensíveis */}
      <Storyboard
        id="AdminStepUpClaro"
        name="Confirmação de PIN · Claro"
        component={AdminStepUpClaro}
        layout={{ x: 0, y: 19770, width: 1440, height: 900 }}
      />
      <Storyboard
        id="AdminStepUpEscuro"
        name="Confirmação de PIN · Escuro"
        component={AdminStepUpEscuro}
        layout={{ x: 1520, y: 19770, width: 1440, height: 900 }}
      />
    </Canvas>
  );
}
