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
      />
      <Storyboard
        id="Admin"
        name="Shell · Admin (escuro)"
        component={Admin2}
        layout={{ x: 1636, y: 0, width: 1556, height: 860 }}
      />
      <Storyboard
        id="Rail"
        name="Shell · sidebar colapsada a 84 px"
        component={Rail2}
        layout={{ x: 0, y: 940, width: 1556, height: 860 }}
      />
      <Storyboard
        id="Cabecalho"
        name="PageHeader e Brand"
        component={Cabecalho2}
        layout={{ x: 1636, y: 940, width: 1180, height: 460, intrinsicSizing: "root-element" }}
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
    "Wordmark da UProperty Market. As duas versões (clara e escura) estão sempre no DOM e a CSS escolhe qual se vê, através dos tokens --logo-light/--logo-dark — o logótipo certo aparece no primeiro paint, sem depender de JS. ⚠ `collapsed` NÃO desenha um ícone: mostra um espaço reservado neutro, porque o ícone final da marca é entregue pelo cliente e 07 §10.1 proíbe inventá-lo ou derivá-lo do wordmark. Os ficheiros são servidos de /brand/logo-light.svg e /brand/logo-dark.svg em cada app.",
  variants: {
    Wordmark: { props: {} },
    NoRail: { props: { collapsed: true } },
  },
});

defineAsset(ThemeToggle, {
  libraries: ["upm-base"],
  usageInstructions:
    "Alternador Claro / Escuro / Sistema (04 §5.2). Três opções e não duas: sem 'Sistema' explícito não há como voltar a seguir o sistema operativo depois de uma escolha manual. `variant='menu'` na topbar (botão com menu); `variant='inline'` em Definições › Aparência, onde a escolha é o conteúdo da secção. Tem de viver dentro de um <ThemeProvider>; a persistência em profiles.theme é injetada por uma Server Action da app.",
  variants: {
    NaTopbar: { props: {} },
    EmDefinicoes: { props: { variant: "inline" } },
  },
});
