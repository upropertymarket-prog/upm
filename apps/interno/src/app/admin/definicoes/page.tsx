import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { createClient } from "@upm/db/server";
import { InternalChrome } from "../../../components/InternalChrome";
import { setLocalePreference } from "../../actions/preferences";
import { verifyOperationPin } from "../../actions/step-up";
import { saveCompanySetting, saveFeatureFlag } from "./actions";
import { SettingsManager } from "./SettingsManager";
import { getAdminSidebarCounters } from "../../../lib/admin-shell";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createClient(await cookies());
  const [{ data: userResult }, flagsResult, settingsResult, sidebarCounters] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc("admin_feature_flags"),
    supabase.rpc("admin_app_settings"),
    getAdminSidebarCounters(supabase),
  ]);
  const profileId = userResult.user?.id ?? null;
  const [{ data: profile }, { data: staff }] = await Promise.all([
    profileId
      ? supabase.from("profiles").select("full_name,locale").eq("id", profileId).maybeSingle()
      : Promise.resolve({ data: null }),
    profileId
      ? supabase
          .from("staff_members")
          .select("department")
          .eq("profile_id", profileId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const flags = (flagsResult.data ?? []).map((flag) => ({
    key: flag.key,
    value: flag.value,
    description: flag.description,
  }));
  const settings = (settingsResult.data ?? []).map((setting) => ({
    key: setting.key,
    value: setting.value,
    description: setting.description,
    public: setting.public,
  }));
  const t = await getTranslations();
  const locale = profile?.locale ?? "pt";
  const userName = profile?.full_name?.trim() || userResult.user?.email || "—";
  const userMeta = staff?.department
    ? `${t("sidebar.groups.admin")} · ${staff.department}`
    : t("sidebar.groups.admin");
  return (
    <InternalChrome
      role="admin"
      userName={userName}
      userMeta={userMeta}
      activeId="settings"
      locale={locale}
      onLocaleChange={setLocalePreference}
      counters={sidebarCounters}
    >
      <SettingsManager
        flags={flags}
        settings={settings}
        integrations={{
          stripe: Boolean(process.env.STRIPE_SECRET_KEY),
          supabase: Boolean(
            process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
          ),
          maptiler: Boolean(process.env.MAPTILER_API_KEY),
          analytics: Boolean(
            process.env.UMAMI_BASE_URL &&
            process.env.UMAMI_WEBSITE_ID &&
            (process.env.UMAMI_API_KEY || process.env.UMAMI_BEARER_TOKEN),
          ),
        }}
        loadError={Boolean(flagsResult.error || settingsResult.error)}
        onSaveFlag={saveFeatureFlag}
        onSaveSetting={saveCompanySetting}
        onVerifyPin={verifyOperationPin}
      />
    </InternalChrome>
  );
}
