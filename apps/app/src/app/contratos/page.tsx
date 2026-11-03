import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { PageHeader } from "@upm/ui";

import { AppChrome } from "../../components/AppChrome";
import { ContractsScreen } from "../../components/contracts/ContractsScreen";
import { ContractEditorClient } from "../../components/contracts/ContractEditorClient";
import { SharedContractView } from "../../components/contracts/SharedContractView";
import { loadShareContacts } from "../../lib/cloud";
import {
  loadContract,
  loadContractHistory,
  loadContracts,
  loadContractsSharedWithMe,
  loadTemplates,
} from "../../lib/contracts";
import { loadNavCounters, loadNotifications } from "../../lib/interaction";
import {
  contractShares,
  createContract,
  logContractExport,
  revokeContractShare,
  saveContract,
  setContractStatus,
  shareContract,
} from "../actions/contracts";
import { setLocalePreference } from "../actions/preferences";

export const dynamic = "force-dynamic";

/**
 * Contratos — `/contratos` (P6-03 · 07 §19.10)
 * =========================================================================
 * Uma rota, dois ecrãs: sem `?contrato=`, a lista; com, o editor. É a navegação
 * que a referência descreve — abre-se um contrato a partir da lista e volta-se
 * a ela — sem inventar uma segunda rota que a sidebar não conhece.
 *
 * O comprador também tem esta página (07 §4.2), mas em leitura: gera contratos
 * quem é dono do imóvel. O que o comprador vê é o que lhe partilharam (07 §5.5)
 * — e é a própria RLS que garante isso, não este `if`.
 */
export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ contrato?: string }>;
}) {
  const supabase = createClient(await cookies());
  const [{ contrato }, locale, { data: authData }] = await Promise.all([
    searchParams,
    getLocale(),
    supabase.auth.getUser(),
  ]);

  const user = authData.user;
  if (!user) redirect("/");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", user.id)
    .single();
  if (!profile || (profile.role !== "owner" && profile.role !== "buyer")) redirect("/");

  const role = profile.role;

  const [contracts, templates, sharedWithMe, contacts, counters, notifications] = await Promise.all(
    [
      loadContracts(supabase),
      role === "owner" ? loadTemplates(supabase) : Promise.resolve([]),
      loadContractsSharedWithMe(supabase),
      loadShareContacts(supabase),
      loadNavCounters(supabase, role),
      loadNotifications(supabase, locale),
    ],
  );

  const chrome = {
    role,
    userName: profile.full_name || (role === "owner" ? "Proprietário" : "Comprador"),
    userMeta: role === "owner" ? "Proprietário" : "Comprador",
    activeId: "contracts",
    locale,
    counters,
    notifications,
  } as const;

  // Um contrato aberto: o meu (editor) ou um que me partilharam (leitura).
  if (contrato) {
    const mine = await loadContract(supabase, contrato, contracts);
    if (mine) {
      const [history, shares] = await Promise.all([
        loadContractHistory(supabase, contrato),
        contractShares(contrato),
      ]);

      return (
        <AppChrome {...chrome} onLocaleChange={setLocalePreference}>
          <ContractEditorClient
            contract={mine}
            history={history}
            contacts={contacts}
            shares={shares}
            onSave={saveContract}
            onSetStatus={setContractStatus}
            onShare={shareContract}
            onRevokeShare={revokeContractShare}
            onLogExport={logContractExport}
          />
        </AppChrome>
      );
    }

    const shared = sharedWithMe.find((row) => row.contractId === contrato);
    if (shared) {
      return (
        <AppChrome {...chrome} onLocaleChange={setLocalePreference}>
          <SharedContractView contract={shared} />
        </AppChrome>
      );
    }

    redirect("/contratos");
  }

  const { data: properties } = await supabase
    .from("properties")
    .select("id, title, ref")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: false });

  const pending = contracts.filter(
    (row) => row.status !== "completed" && row.status !== "signed",
  ).length;

  return (
    <AppChrome {...chrome} onLocaleChange={setLocalePreference}>
      <PageHeader
        title="Contratos"
        subtitle={
          pending === 0
            ? "Nenhum contrato por fechar"
            : `${pending} ${pending === 1 ? "contrato por fechar" : "contratos por fechar"}`
        }
      />
      <ContractsScreen
        contracts={contracts}
        templates={templates}
        sharedWithMe={sharedWithMe}
        properties={(properties ?? []).map((property) => ({
          id: property.id,
          title: property.title || property.ref,
        }))}
        canCreate={role === "owner"}
        onCreate={createContract}
      />
    </AppChrome>
  );
}
