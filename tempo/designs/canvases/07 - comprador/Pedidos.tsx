import { VisitsScreen } from "../../../../apps/app/src/components/visits/VisitsScreen";

import { Shell } from "./Shell";
import { demoOk, demoVisits } from "./demo";

/**
 * `/meus-pedidos` — os pedidos de visita do comprador (04 §2.4).
 * =========================================================================
 * É o `VisitsScreen` verdadeiro, o mesmo componente que serve a Agenda do
 * proprietário em `/agenda`. O que muda é o `role`: com `role="buyer"` o ecrã
 * deixa de oferecer "aceitar" sobre pedidos alheios e passa a mostrar o estado
 * dos que esta pessoa fez.
 *
 * As quatro ações devolvem `{}` — no canvas não há nada para escrever. O toast
 * de confirmação aparece na mesma, que é o comportamento que se quer rever.
 *
 * O mês do calendário é fixo (`2026-09`): o `currentMonth()` da app lê o
 * relógio e faria a storyboard mudar de forma todos os meses.
 *
 * O cabeçalho vem do próprio `VisitsScreen`, por isso o `Shell` entra com
 * `hideHeader` — dois títulos empilhados era o que acontecia sem isto.
 *
 * ## Porque são duas molduras
 *
 * - **Com pedidos** — os três estados que decidem o ecrã: um por confirmar
 *   (ainda sem resposta da proprietária), um aceite (já com hora marcada) e um
 *   remarcado por ela, que é o caso em que a bola está do lado do comprador.
 * - **Sem pedidos** — o estado de quem ainda não pediu nada, e o primeiro que
 *   qualquer conta nova vê. Sem ele não se sabe se o ecrã explica o que fazer
 *   a seguir ou se mostra uma lista vazia e muda.
 */
function PedidosDemo({ theme, rows }: { theme: "light" | "dark"; rows: typeof demoVisits }) {
  return (
    <Shell theme={theme} activeId="myRequests" title="" subtitle="" hideHeader>
      <VisitsScreen
        rows={rows}
        pageTitle="Meus pedidos"
        pageSubtitle="Os pedidos de visita que fez e o estado de cada um"
        role="buyer"
        month="2026-09"
        onAccept={demoOk}
        onReschedule={demoOk}
        onCancel={demoOk}
        onArchive={demoOk}
      />
    </Shell>
  );
}

export function CompradorPedidosClaro() {
  return <PedidosDemo theme="light" rows={demoVisits} />;
}

export function CompradorPedidosEscuro() {
  return <PedidosDemo theme="dark" rows={demoVisits} />;
}

export function CompradorPedidosVazio() {
  return <PedidosDemo theme="light" rows={[]} />;
}

export function CompradorPedidosVazioEscuro() {
  return <PedidosDemo theme="dark" rows={[]} />;
}
