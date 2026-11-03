import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { PageHeader } from "@upm/ui";

import { AppChrome } from "../../components/AppChrome";
import { MessagesPageClient } from "../../components/messages/MessagesPageClient";
import {
  loadNavCounters,
  loadConversationDetail,
  loadConversations,
  loadNotifications,
} from "../../lib/interaction";
import {
  attachmentUrl,
  markConversationRead,
  saveAttachmentToCloud,
  sendAttachment,
  sendMessage,
  shareExactAddress,
} from "../actions/conversations";
import { setLocalePreference } from "../actions/preferences";

export const dynamic = "force-dynamic";

/**
 * Mensagens — `/mensagens` (P5-01 · 04 §8.3 e §8.4 · 03 F5)
 * =========================================================================
 * A mesma rota para os dois papéis, como 07 §4.2/§4.3 a colocam nos dois menus:
 * o ecrã é o mesmo e o que muda é de que lado da conversa se está — e isso vem
 * dos dados, não de um ramo de código.
 */
export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ conversa?: string }>;
}) {
  const { conversa } = await searchParams;
  const supabase = createClient(await cookies());
  const [locale, tNav, t, { data: authData }] = await Promise.all([
    getLocale(),
    getTranslations("nav"),
    getTranslations("messages"),
    supabase.auth.getUser(),
  ]);

  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  const role = profile?.role === "owner" ? "owner" : "buyer";

  const [conversations, counters, notifications] = await Promise.all([
    loadConversations(supabase),
    loadNavCounters(supabase, role),
    loadNotifications(supabase, locale),
  ]);

  // Sem conversa escolhida abre a primeira — a lista nunca fica ao lado de um
  // painel vazio quando há alguma coisa para mostrar.
  const activeId = conversa ?? conversations[0]?.id ?? null;
  const active = activeId
    ? await loadConversationDetail(supabase, user.id, activeId, conversations)
    : null;

  return (
    <AppChrome
      role={role}
      userName={profile?.full_name || "Utilizador"}
      userMeta={role === "owner" ? "Proprietário" : "Comprador"}
      activeId="messages"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={counters}
      notifications={notifications}
      // A área útil deste ecrã é a janela: os dois painéis vão até ao fim e
      // rolam por dentro, em vez de a página rolar por baixo deles.
      fill
    >
      <PageHeader title={tNav("messages")} subtitle={t("pageSubtitle")} />
      <MessagesPageClient
        conversations={conversations}
        active={active}
        onSend={sendMessage}
        onShareAddress={shareExactAddress}
        onSendAttachment={sendAttachment}
        onOpenAttachment={attachmentUrl}
        onSaveAttachmentToCloud={saveAttachmentToCloud}
        onMarkRead={markConversationRead}
      />
    </AppChrome>
  );
}
