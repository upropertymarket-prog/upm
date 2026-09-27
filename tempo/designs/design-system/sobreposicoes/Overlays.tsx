"use client";

/**
 * Narração de canvas — Modal, Drawer e Toast (04 §5.4 · 04 §5.7)
 * =========================================================================
 * Estes três componentes só existem abertos, e abrem em portal para o
 * `document.body`. Por isso o storyboard é interativo: carregue nos botões.
 */
import { useState } from "react";
import { CalendarDays } from "lucide-react";

import { Button } from "../../../../packages/ui/src/components/Button";
import { Input, Textarea } from "../../../../packages/ui/src/components/Input";
import { Select } from "../../../../packages/ui/src/components/Select";
import { Drawer, Modal } from "../../../../packages/ui/src/components/Overlay";
import { StatusTag } from "../../../../packages/ui/src/components/StatusTag";
import { ToastProvider, useToast } from "../../../../packages/ui/src/components/Toast";
import { Note, Row, ThemePair } from "../../_narration/ThemePair";

function OverlayDemo() {
  const [modal, setModal] = useState(false);
  const [drawer, setDrawer] = useState(false);

  return (
    <>
      <Row label="Modal · decisões e tarefas curtas (04 §5.4)">
        <Button onClick={() => setModal(true)}>Pedir visita</Button>
      </Row>
      <Row label="Drawer · ver/editar um registo vindo de uma lista, 460 px">
        <Button variant="secondary" onClick={() => setDrawer(true)}>
          Abrir detalhe do imóvel
        </Button>
      </Row>
      <Note>
        `Esc` fecha, o clique no véu fecha, o `Tab` fica preso dentro do painel e o foco volta ao
        botão de origem — 04 §5.7. Como os dois abrem em portal no `document.body`, no canvas saem
        do invólucro de tema e pintam-se com o tema do host (claro).
      </Note>

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Pedir visita"
        subtitle="O proprietário recebe uma notificação e responde na Agenda de visitas."
        icon={<CalendarDays size={18} />}
        footer={
          <>
            <Button variant="ghost" onClick={() => setModal(false)}>
              Cancelar
            </Button>
            <Button onClick={() => setModal(false)}>Enviar pedido</Button>
          </>
        }
      >
        <Input label="Data" type="date" defaultValue="2026-10-03" />
        <Input label="Hora" type="time" defaultValue="11:00" />
        <Textarea label="Mensagem" hint="Opcional." />
      </Modal>

      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        title="Apartamento T3 com varanda"
        subtitle="UPM-1041 · Lisboa · Campo de Ourique"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDrawer(false)}>
              Fechar
            </Button>
            <Button onClick={() => setDrawer(false)}>Guardar</Button>
          </>
        }
      >
        <StatusTag tone="pending">Em moderação</StatusTag>
        <Input label="Preço" defaultValue="485 000 €" />
        <Select
          label="Negócio"
          defaultValue="sale"
          options={[
            { value: "sale", label: "Venda" },
            { value: "rent", label: "Arrendamento" },
          ]}
        />
        <Textarea label="Notas da moderação" />
      </Drawer>
    </>
  );
}

/** Modal e Drawer — abra-os no storyboard para ver o comportamento. */
export function ModalEDrawer() {
  return (
    <ThemePair>
      <OverlayDemo />
    </ThemePair>
  );
}

function ToastDemo() {
  const { toast } = useToast();
  return (
    <>
      <Row label="Três tons · region aria-live=polite (04 §5.7)">
        <Button onClick={() => toast("Alterações guardadas", "success")}>Sucesso</Button>
        <Button variant="secondary" onClick={() => toast("Pedido de visita enviado", "info")}>
          Informação
        </Button>
        <Button variant="danger" onClick={() => toast("Não foi possível transferir", "error")}>
          Erro
        </Button>
      </Row>
      <Note>
        `polite` e não `assertive`: um toast confirma uma ação que o utilizador acabou de fazer, e
        interromper a leitura em curso seria pior. Erros que exigem uma decisão são modal, não
        toast. Dura 2,4 s, a duração dos protótipos.
      </Note>
    </>
  );
}

/** Toast — o provider tem de envolver quem chama `useToast`. */
export function Toasts() {
  return (
    <ToastProvider>
      <ThemePair>
        <ToastDemo />
      </ThemePair>
    </ToastProvider>
  );
}
