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

export default function AdminCanvas() {
  return (
    <Canvas name="Admin" backgroundColor="#232323">
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

      {/* Definições */}
      <Storyboard
        id="AdminDefinicoesClaro"
        name="Definições · Claro"
        component={AdminDefinicoesClaro}
        layout={{ x: 0, y: 12160, width: 1440, height: 1150 }}
      />
      <Storyboard
        id="AdminDefinicoesEscuro"
        name="Definições · Escuro"
        component={AdminDefinicoesEscuro}
        layout={{ x: 1520, y: 12160, width: 1440, height: 1150 }}
      />

      {/* Diálogo transversal às ações sensíveis */}
      <Storyboard
        id="AdminStepUpClaro"
        name="Confirmação de PIN · Claro"
        component={AdminStepUpClaro}
        layout={{ x: 0, y: 13390, width: 1440, height: 900 }}
      />
      <Storyboard
        id="AdminStepUpEscuro"
        name="Confirmação de PIN · Escuro"
        component={AdminStepUpEscuro}
        layout={{ x: 1520, y: 13390, width: 1440, height: 900 }}
      />
    </Canvas>
  );
}
