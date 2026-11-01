import { Canvas, Storyboard } from "tempo-sdk/canvas";
import { defineAsset } from "tempo-sdk/assets";

import { AppShell } from "../../../../packages/ui/src/shell/AppShell";
import { Brand } from "../../../../packages/ui/src/shell/Brand";
import { PageHeader } from "../../../../packages/ui/src/shell/PageHeader";
import { ThemeToggle } from "../../../../packages/ui/src/theme/ThemeToggle";
import { Proprietario as Proprietario2 } from "./Shell";
import { Admin as Admin2 } from "./Shell";
import { Rail as Rail2 } from "./Shell";
import { Cabecalho as Cabecalho2 } from "./Shell";

export default function AppShellCanvas() {
  return (
    <Canvas name="App Shell" backgroundColor="#232323">
      <Storyboard
        id="Proprietario"
        name="Shell · Proprietário (claro)"
        component={Proprietario2}
        layout={{ x: 0, y: 0, width: 1556, height: 860 }}
        vrt
      />
      <Storyboard
        id="Admin"
        name="Shell · Admin (escuro)"
        component={Admin2}
        layout={{ x: 1636, y: 0, width: 1556, height: 860 }}
        vrt
      />
      <Storyboard
        id="Rail"
        name="Shell · sidebar colapsada a 84 px"
        component={Rail2}
        layout={{ x: 0, y: 940, width: 1556, height: 860 }}
        vrt
      />
      <Storyboard
        id="Cabecalho"
        name="PageHeader e Brand"
        component={Cabecalho2}
        layout={{ x: 1636, y: 940, width: 1180, height: 460, intrinsicSizing: "root-element" }}
        vrt
      />
    </Canvas>
  );
}

defineAsset(AppShell, {
  libraries: ["upm-base"],
  usageInstructions:
    "Shell das apps autenticadas: sidebar 248 px (colapsável para 84 px) + topbar 68 px + conteúdo (04 §5.5). É IDÊNTICO nos 4 perfis — comprador, proprietário, admin e suporte recebem este mesmo componente e só mudam a lista de navegação (07 §4.1–§4.3) e a etiqueta de grupo. Não o copie por perfil. Abaixo de 1024 px a sidebar fica em rail e abaixo de 768 px passa a drawer (02 §13). A preferência de rail é do dispositivo (localStorage), não da conta. O site público NÃO usa este shell: 03 §1.1 pede navbar fixa e âncoras.",
  variants: {
    Proprietario: {
      props: {
        sidebar: {
          groups: [{ label: "Gerir", items: [] }],
          activeId: "dashboard",
          user: { name: "Ana Silva", meta: "Proprietária · Premium", initials: "AS", online: true },
          onReport: () => undefined,
          onSignOut: () => undefined,
          labels: {
            collapse: "Colapsar menu",
            expand: "Expandir menu",
            report: "Reportar problema",
            signOut: "Sair",
            countSuffix: "por ler",
          },
        },
        topbar: {
          labels: {
            search: "Pesquisar",
            openMenu: "Abrir menu",
            language: "Idioma",
            notifications: "Notificações",
            markAllRead: "Marcar como lidas",
            noNotifications: "Sem notificações",
            theme: { title: "Tema", light: "Claro", dark: "Escuro", system: "Sistema" },
          },
          locale: "pt",
          locales: [{ value: "pt", label: "Português" }],
          onLocaleChange: () => undefined,
          notifications: [],
          onMarkAllRead: () => undefined,
        },
        children: "Conteúdo da página",
      },
    },
  },
});

defineAsset(PageHeader, {
  libraries: ["upm-base"],
  usageInstructions:
    "Cabeçalho de página dentro do shell (04 §5.5). No Painel o `title` é a saudação ('Boa tarde, Ana' — use `greetingKey()` para escolher a chave de tradução); nas restantes páginas é o título com subtítulo. `actions` leva Exportar mais a ação primária do contexto, alinhadas à direita.",
  variants: {
    ComSubtitulo: {
      props: {
        title: "As minhas propriedades",
        subtitle: "Aqui pode gerir todo o seu portfólio",
      },
    },
    Saudacao: { props: { title: "Boa tarde, Ana", subtitle: "Resumo da sua atividade e ativos" } },
  },
});

defineAsset(Brand, {
  libraries: ["upm-base"],
  usageInstructions:
    "Wordmark da UProperty Market. As duas versões (clara e escura) estão sempre no DOM e a CSS escolhe qual se vê, através dos tokens --logo-light/--logo-dark — o logótipo certo aparece no primeiro paint, sem depender de JS. `collapsed` troca o wordmark pelo ícone da marca (40 px, o alvo mínimo), com o mesmo par claro/escuro — é o que o rail de 84 px usa. O ícone traz o seu próprio quadrado de fundo: não lhe ponhas moldura nem fundo por fora. Os ficheiros são servidos de /brand/logo-*.svg e /brand/icon-*.svg em cada app; a origem é design/brand/.",
  variants: {
    Wordmark: { props: {} },
    NoRail: { props: { collapsed: true } },
  },
});

defineAsset(ThemeToggle, {
  libraries: ["upm-base"],
  usageInstructions:
    "Alternador de tema (04 §5.2). `variant='segmented'` na topbar: só Claro e Escuro, a troca do dia a dia a um clique — com 'Sistema' escolhido marca o tema aplicado. `variant='inline'` em Definições › Aparência: as três opções, incluindo 'Sistema', porque sem ela não há como voltar a seguir o sistema operativo depois de uma escolha manual — não remover de lá. `variant='menu'` (botão com menu) onde a largura não chegar para rótulos. Tem de viver dentro de um <ThemeProvider>; a persistência em profiles.theme é injetada por uma Server Action da app.",
  variants: {
    NaTopbar: { props: { variant: "segmented" as const } },
    EmDefinicoes: { props: { variant: "inline" as const } },
    ComoMenu: { props: {} },
  },
});
