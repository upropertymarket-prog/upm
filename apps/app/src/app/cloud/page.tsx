import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { formatBytes } from "@upm/db/cloud";

import { AppChrome } from "../../components/AppChrome";
import { CloudScreen } from "../../components/cloud/CloudScreen";
import {
  loadCloudStatus,
  loadFiles,
  loadFolders,
  loadShareContacts,
  loadSharedWithMe,
} from "../../lib/cloud";
import {
  countersFor,
  loadConversations,
  loadLeads,
  loadNotifications,
  loadVisits,
} from "../../lib/interaction";
import {
  createFolder,
  deleteFile,
  deleteFolder,
  emptyRecycleBin,
  fileDetails,
  fileDownloadUrl,
  replaceFile,
  restoreFileVersion,
  revokeFileShare,
  shareFile,
  uploadFile,
} from "../actions/cloud";
import { setLocalePreference } from "../actions/preferences";

export const dynamic = "force-dynamic";

/**
 * Cloud — `/cloud` (P6-01 · P6-02 · 07 §19.10)
 * =========================================================================
 * Os dois papéis têm esta página (07 §4.2 e §4.3): o proprietário guarda as
 * certidões e as plantas, o comprador guarda o que lhe partilharam. O que muda
 * entre eles é o conteúdo, não o ecrã.
 *
 * `/cloud` e `/contratos` são **dois ecrãs** — 07 §19.10 fechou o erro de
 * rótulo de 04 §8.3, onde a linha chamada "Cloud" descrevia, do princípio ao
 * fim, o editor de contratos.
 *
 * Quem não tem Cloud no plano chega aqui na mesma e vê o convite de 07 §19.4,
 * nunca uma Cloud vazia que não explica porque está vazia. Por isso a página
 * carrega sempre o estado primeiro e só depois o resto.
 */
export default async function CloudPage() {
  const supabase = createClient(await cookies());
  const [locale, { data: authData }] = await Promise.all([getLocale(), supabase.auth.getUser()]);

  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "owner" && profile.role !== "buyer")) redirect("/");

  const role = profile.role;
  const status = await loadCloudStatus(supabase);

  const [folders, files, sharedWithMe, contacts, conversations, visits, leads, notifications] =
    await Promise.all([
      status.hasCloud ? loadFolders(supabase) : Promise.resolve([]),
      status.hasCloud ? loadFiles(supabase) : Promise.resolve([]),
      loadSharedWithMe(supabase),
      loadShareContacts(supabase),
      loadConversations(supabase),
      loadVisits(supabase),
      role === "owner" ? loadLeads(supabase) : Promise.resolve([]),
      loadNotifications(supabase),
    ]);

  const subtitle = !status.hasCloud
    ? "A Cloud está incluída a partir do plano Essential"
    : status.limitBytes === null
      ? `${formatBytes(status.usedBytes)} usados · armazenamento ilimitado`
      : `${formatBytes(status.usedBytes)} de ${formatBytes(status.limitBytes)} usados`;

  return (
    <AppChrome
      role={role}
      userName={profile.full_name || (role === "owner" ? "Proprietário" : "Comprador")}
      userMeta={role === "owner" ? "Proprietário" : "Comprador"}
      activeId="cloud"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={countersFor(role, conversations, visits, leads)}
      notifications={notifications}
    >
      <CloudScreen
        subtitle={subtitle}
        status={status}
        folders={folders}
        files={files}
        sharedWithMe={sharedWithMe}
        contacts={contacts}
        onCreateFolder={createFolder}
        onDeleteFolder={deleteFolder}
        onUpload={uploadFile}
        onReplace={replaceFile}
        onDelete={deleteFile}
        onEmptyRecycleBin={emptyRecycleBin}
        onDownloadUrl={fileDownloadUrl}
        onShare={shareFile}
        onRevokeShare={revokeFileShare}
        onLoadDetails={fileDetails}
        onRestoreVersion={restoreFileVersion}
      />
    </AppChrome>
  );
}
