import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { ToastProvider } from "../../../../packages/ui/src/components/Toast";
import { Card } from "../../../../packages/ui/src/components/Card";
import { PageHeader } from "../../../../packages/ui/src/shell/PageHeader";
import { ThemeToggle } from "../../../../packages/ui/src/theme/ThemeToggle";

import { AppChrome } from "../../../../apps/app/src/components/AppChrome";
import { PropertyMap } from "../../../../apps/app/src/components/map/PropertyMap";
import { NotificationPrefsForm } from "../../../../apps/app/src/components/settings/NotificationPrefsForm";
import ptMessages from "../../../../packages/config/messages/pt.json";
import { demoLocaleChange, demoNotifications } from "./demo";
import { NoNavigation } from "./NoNavigation";
import {
  demoDrawPolygon,
  demoMapProperties,
  demoNotificationPrefs,
  demoSavePrefs,
} from "./demoMarket";

/**
 * Mapa e Definições — os dois ecrãs do Proprietário que faltavam ao canvas
 * fora do grupo de imóveis.
 *
 * **O Mapa usa a rede.** O `PropertyMap` carrega os mosaicos do OpenFreeMap
 * (`MAP_STYLE`), por isso esta é a única storyboard do canvas que não é
 * autossuficiente: sem ligação, aparecem os marcadores sobre um fundo vazio.
 * É também por isso que não deve ser marcada para VRT — os mosaicos chegam
 * quando chegam, e a baseline flutuava.
 *
 * `contentWidth="full"` no Mapa, como a rota: 04 §1.5 trata-o como a exceção
 * ao limite de 1600 px, porque aqui o conteúdo é a própria área visível.
 */
function Shell({
  theme,
  activeId,
  contentWidth = "default",
  children,
}: {
  theme: "light" | "dark";
  activeId: string;
  contentWidth?: "default" | "full";
  children: React.ReactNode;
}) {
  return (
    <div data-theme={theme} style={{ background: "var(--bg)", height: "900px" }}>
      <NoNavigation>
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
          <ThemeProvider initialChoice={theme}>
            <ToastProvider>
              <AppChrome
                role="owner"
                userName="Ana Silva"
                userMeta="Proprietária · Premium"
                activeId={activeId}
                locale="pt"
                onLocaleChange={demoLocaleChange}
                contentWidth={contentWidth}
                counters={{ leads: 9, messages: 3, visitSchedule: 3, contracts: 1 }}
                notifications={demoNotifications}
                liveNotifications={false}
                appUpdates={false}
              >
                {children}
              </AppChrome>
            </ToastProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </NoNavigation>
    </div>
  );
}

type Tema = { theme: "light" | "dark" };

/** `/mapa` — imóveis sobre o mapa, com desenho de polígono. */
function MapaDemo({ theme }: Tema) {
  return (
    <Shell theme={theme} activeId="map" contentWidth="full">
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <PageHeader title="Mapa" subtitle="Imóveis publicados na sua zona" />
        <PropertyMap initialProperties={demoMapProperties} onDrawPolygon={demoDrawPolygon} />
      </div>
    </Shell>
  );
}

/**
 * `/definicoes` — as duas secções que existem hoje: Notificações e Aparência.
 *
 * As outras três de 04 §8.3 (Perfil, Preferências, Zona de perigo) não estão
 * aqui porque não estão na página: a storyboard mostra o que o produto tem,
 * não o que está prometido.
 */
function DefinicoesDemo({ theme }: Tema) {
  return (
    <Shell theme={theme} activeId="settings">
      <PageHeader title="Definições" subtitle="Conta, perfil e notificações" />
      <div style={{ display: "grid", gap: "var(--sp-8)" }}>
        <NotificationPrefsForm prefs={demoNotificationPrefs} onSave={demoSavePrefs} />
        <Card padded style={{ display: "grid", gap: "var(--sp-6)" }}>
          <div style={{ display: "grid", gap: "var(--sp-2)" }}>
            <h2 style={{ margin: 0, fontSize: "var(--fs-subtitle-lg)" }}>Aparência</h2>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              A escolha fica guardada nesta conta e segue-a noutros dispositivos.
            </p>
          </div>
          <ThemeToggle
            variant="inline"
            labels={{
              title: "Tema",
              light: "Claro",
              dark: "Escuro",
              system: "Sistema",
            }}
          />
        </Card>
      </div>
    </Shell>
  );
}

export function MapaClaro() {
  return <MapaDemo theme="light" />;
}
export function MapaEscuro() {
  return <MapaDemo theme="dark" />;
}
export function DefinicoesClaro() {
  return <DefinicoesDemo theme="light" />;
}
export function DefinicoesEscuro() {
  return <DefinicoesDemo theme="dark" />;
}
