/**
 * Admin da Fase 8 — matriz de acesso e RPCs (08 §2.3).
 *
 * Exercita as novas tabelas de utilizadores, moderação, leads e definições por
 * papel contra staging. Os fixtures são criados com service_role; as tentativas
 * são feitas com sessões anon, buyer, owner, admin e support.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { listarTodosOsUtilizadores } from "./test-users";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

const PASSWORD = "admin-rls-test-P@ss1";
const USERS = {
  admin: { email: "admin-matrix-admin@upropertymarket.test", role: "admin" },
  support: { email: "admin-matrix-support@upropertymarket.test", role: "support" },
  owner: { email: "admin-matrix-owner@upropertymarket.test", role: "owner" },
  buyer: { email: "admin-matrix-buyer@upropertymarket.test", role: "buyer" },
} as const;

type Role = keyof typeof USERS | "anon";

describe.skipIf(!hasEnv)("Admin — matriz RLS da Fase 8", () => {
  let service: SupabaseClient;
  const clients = {} as Record<Role, SupabaseClient>;
  const ids = {} as Record<keyof typeof USERS, string>;
  let propertyId: string;
  let leadId: string;
  let personalAccessLogId: number;
  let moderationEventId: number;
  let leadEventId: number;
  let privateSettingKey: string;
  const writeProbeKeys: string[] = [];

  async function getOrCreateUser(email: string, role: string) {
    const { data: users, error: listError } = await listarTodosOsUtilizadores(service);
    if (listError) throw new Error(`Falha a listar utilizadores: ${listError.message}`);
    const found = users.users.find((user) => user.email === email);
    if (found) return found.id;

    const { data, error } = await service.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { role },
    });
    if (error || !data.user) throw new Error(`Falha a criar ${email}: ${error?.message}`);
    return data.user.id;
  }

  beforeAll(async () => {
    service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!);
    clients.anon = createClient(SUPABASE_URL!, ANON_KEY!);

    for (const role of Object.keys(USERS) as (keyof typeof USERS)[]) {
      const fixture = USERS[role];
      ids[role] = await getOrCreateUser(fixture.email, fixture.role);
      const { error: profileError } = await service
        .from("profiles")
        .update({ role: fixture.role, status: "active" })
        .eq("id", ids[role]);
      if (profileError) throw new Error(`Falha a preparar ${role}: ${profileError.message}`);

      const client = createClient(SUPABASE_URL!, ANON_KEY!);
      const { error } = await client.auth.signInWithPassword({
        email: fixture.email,
        password: PASSWORD,
      });
      if (error) throw new Error(`Falha a autenticar ${fixture.email}: ${error.message}`);
      clients[role] = client;
    }

    const marker = crypto.randomUUID();
    privateSettingKey = `admin_rls_${marker.replaceAll("-", "")}`;

    const { data: property, error: propertyError } = await service
      .from("properties")
      .insert({
        owner_id: ids.owner,
        ref: `ADMIN-RLS-${marker}`,
        deal: "sale",
        status: "pending_review",
        typology: "T2",
      })
      .select("id")
      .single();
    if (propertyError || !property) {
      throw new Error(`Fixture do imóvel: ${propertyError?.message}`);
    }
    propertyId = property.id;

    const { data: moderationEvent, error: moderationError } = await service
      .from("property_moderation_events")
      .insert({
        property_id: propertyId,
        actor_id: ids.admin,
        action: "approved",
        status_from: "pending_review",
        status_to: "active",
        reason: "fixture de teste",
      })
      .select("id")
      .single();
    if (moderationError || !moderationEvent) {
      throw new Error(`Fixture do histórico de moderação: ${moderationError?.message}`);
    }
    moderationEventId = moderationEvent.id;

    const { data: lead, error: leadError } = await service
      .from("site_leads")
      .insert({
        source: "pre_launch",
        form: "preinscricao",
        name: "Lead de teste RLS",
        email: `admin-rls-${marker}@upropertymarket.test`,
        profile_type: "owner",
        message: "Fixture privada para a matriz de acesso.",
      })
      .select("id")
      .single();
    if (leadError || !lead) throw new Error(`Fixture da lead: ${leadError?.message}`);
    leadId = lead.id;

    const { data: leadEvent, error: leadEventError } = await service
      .from("site_lead_events")
      .insert({
        lead_id: leadId,
        kind: "note",
        body: "Fixture de histórico.",
        actor_id: ids.admin,
      })
      .select("id")
      .single();
    if (leadEventError || !leadEvent) {
      throw new Error(`Fixture do histórico de leads: ${leadEventError?.message}`);
    }
    leadEventId = leadEvent.id;

    const { data: accessLog, error: accessError } = await service
      .from("personal_data_access_log")
      .insert({
        actor_profile_id: ids.admin,
        subject_type: "profile",
        subject_id: ids.owner,
        action: "view",
      })
      .select("id")
      .single();
    if (accessError || !accessLog) {
      throw new Error(`Fixture do registo de acesso: ${accessError?.message}`);
    }
    personalAccessLogId = accessLog.id;

    const { error: settingError } = await service.from("app_settings").insert({
      key: privateSettingKey,
      value: '"secret fixture"',
      public: false,
      description: "Fixture privada para a matriz de acesso.",
    });
    if (settingError) throw new Error(`Fixture de definição: ${settingError.message}`);

    const { error: flagError } = await service.from("feature_flags").insert({
      key: privateSettingKey,
      value: '"fixture"',
      description: "Fixture privada para a matriz de acesso.",
    });
    if (flagError) throw new Error(`Fixture de feature flag: ${flagError.message}`);
  });

  afterAll(async () => {
    if (!hasEnv || !service) return;
    if (privateSettingKey) await service.from("app_settings").delete().eq("key", privateSettingKey);
    if (privateSettingKey)
      await service.from("feature_flags").delete().eq("key", privateSettingKey);
    for (const key of writeProbeKeys) {
      await service.from("app_settings").delete().eq("key", key);
      await service.from("feature_flags").delete().eq("key", key);
    }
    if (leadEventId) await service.from("site_lead_events").delete().eq("id", leadEventId);
    if (leadId) await service.from("site_leads").delete().eq("id", leadId);
    if (moderationEventId) {
      await service.from("property_moderation_events").delete().eq("id", moderationEventId);
    }
    if (propertyId) await service.from("properties").delete().eq("id", propertyId);
    // `personal_data_access_log` não se limpa: é só de acrescentar desde o A8
    // (2 nov), também para a service_role. A linha de teste fica, como fica
    // qualquer consulta real.
  });

  it("personal_data_access_log é só de leitura e só o admin vê os registos", async () => {
    const { data: adminRows, error: adminError } = await clients.admin
      .from("personal_data_access_log")
      .select("id")
      .eq("id", personalAccessLogId);
    expect(adminError).toBeNull();
    expect(adminRows).toHaveLength(1);

    for (const role of ["support", "owner", "buyer"] as const) {
      const { data, error } = await clients[role]
        .from("personal_data_access_log")
        .select("id")
        .eq("id", personalAccessLogId);
      expect(error).toBeNull();
      expect(data?.length ?? 0, role).toBe(0);
    }

    const anonymousRead = await clients.anon
      .from("personal_data_access_log")
      .select("id")
      .eq("id", personalAccessLogId);
    expect(anonymousRead.error || anonymousRead.data?.length === 0).toBeTruthy();

    for (const role of ["anon", "admin", "support", "owner", "buyer"] as const) {
      const client = clients[role];
      const insert = await client
        .from("personal_data_access_log")
        .insert({
          actor_profile_id: ids.admin,
          subject_type: "profile",
          subject_id: ids.buyer,
          action: "view",
        })
        .select("id");
      expect(insert.error ?? insert.data?.length, `insert ${role}`).toBeTruthy();

      const update = await client
        .from("personal_data_access_log")
        .update({ subject_id: ids.buyer })
        .eq("id", personalAccessLogId)
        .select("id");
      expect(update.error ?? update.data?.length, `update ${role}`).toBeTruthy();

      const remove = await client
        .from("personal_data_access_log")
        .delete()
        .eq("id", personalAccessLogId)
        .select("id");
      expect(remove.error ?? remove.data?.length, `delete ${role}`).toBeTruthy();
    }
  });

  it("property_moderation_events permite staff e dono do imóvel, sem escrita direta", async () => {
    for (const role of ["admin", "support", "owner"] as const) {
      const { data, error } = await clients[role]
        .from("property_moderation_events")
        .select("id")
        .eq("id", moderationEventId);
      expect(error, role).toBeNull();
      expect(data, role).toHaveLength(1);
    }

    for (const role of ["buyer"] as const) {
      const { data, error } = await clients[role]
        .from("property_moderation_events")
        .select("id")
        .eq("id", moderationEventId);
      expect(error).toBeNull();
      expect(data?.length ?? 0, role).toBe(0);
    }

    const anonymousRead = await clients.anon
      .from("property_moderation_events")
      .select("id")
      .eq("id", moderationEventId);
    expect(anonymousRead.error || anonymousRead.data?.length === 0).toBeTruthy();

    for (const role of ["anon", "buyer", "owner", "admin", "support"] as const) {
      const client = clients[role];
      const forgedInsert = await client
        .from("property_moderation_events")
        .insert({
          property_id: propertyId,
          actor_id: ids.admin,
          action: "approved",
          status_from: "pending_review",
          status_to: "active",
        })
        .select("id");
      expect(forgedInsert.error ?? forgedInsert.data?.length, `insert ${role}`).toBeTruthy();

      const update = await client
        .from("property_moderation_events")
        .update({ reason: "forged" })
        .eq("id", moderationEventId)
        .select("id");
      expect(update.error ?? update.data?.length, `update ${role}`).toBeTruthy();

      const remove = await client
        .from("property_moderation_events")
        .delete()
        .eq("id", moderationEventId)
        .select("id");
      expect(remove.error ?? remove.data?.length, `delete ${role}`).toBeTruthy();
    }

    const forgedOwnerUpdate = await clients.owner
      .from("properties")
      .update({ status: "active" })
      .eq("id", propertyId)
      .select("id");
    expect(forgedOwnerUpdate.error !== null || forgedOwnerUpdate.data?.length === 0).toBe(true);
    const { data: unchangedProperty } = await service
      .from("properties")
      .select("status")
      .eq("id", propertyId)
      .single();
    expect(unchangedProperty?.status).toBe("pending_review");
  });

  it("site_leads e site_lead_events são privados ao admin e append-only", async () => {
    for (const table of ["site_leads", "site_lead_events"] as const) {
      const rowId = table === "site_leads" ? leadId : leadEventId;
      const { data, error } = await clients.admin.from(table).select("id").eq("id", rowId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);

      for (const role of ["support", "owner", "buyer", "anon"] as const) {
        const { data: hidden } = await clients[role].from(table).select("id").eq("id", rowId);
        expect(hidden?.length ?? 0, `${table} ${role}`).toBe(0);
      }
    }

    for (const role of ["anon", "buyer", "owner", "admin", "support"] as const) {
      const client = clients[role];
      const forgedLead = await client
        .from("site_leads")
        .insert({
          source: "pre_launch",
          form: "preinscricao",
          name: "Lead forjada",
          email: `forged-${role}@upropertymarket.test`,
          profile_type: "owner",
        })
        .select("id");
      expect(forgedLead.error ?? forgedLead.data?.length, `insert lead ${role}`).toBeTruthy();

      const forgedEvent = await client
        .from("site_lead_events")
        .insert({ lead_id: leadId, kind: "note", body: "forged", actor_id: ids.admin })
        .select("id");
      expect(forgedEvent.error ?? forgedEvent.data?.length, `insert event ${role}`).toBeTruthy();

      const updateEvent = await client
        .from("site_lead_events")
        .update({ body: "forged edit" })
        .eq("id", leadEventId)
        .select("id");
      expect(updateEvent.error ?? updateEvent.data?.length, `update event ${role}`).toBeTruthy();

      const update = await client
        .from("site_leads")
        .update({ status: "converted" })
        .eq("id", leadId)
        .select("id");
      expect(update.error ?? update.data?.length, `update ${role}`).toBeTruthy();

      const removeLead = await client.from("site_leads").delete().eq("id", leadId).select("id");
      expect(removeLead.error ?? removeLead.data?.length, `delete lead ${role}`).toBeTruthy();

      const removeEvent = await client
        .from("site_lead_events")
        .delete()
        .eq("id", leadEventId)
        .select("id");
      expect(removeEvent.error ?? removeEvent.data?.length, `delete event ${role}`).toBeTruthy();
    }
  });

  it("app_settings só mostra linhas públicas e feature_flags só expõe launch_mode", async () => {
    const { data: publicSetting, error: publicSettingError } = await clients.anon
      .from("app_settings")
      .select("key")
      .eq("key", "company_name");
    expect(publicSettingError).toBeNull();
    expect(publicSetting).toHaveLength(1);

    const { data: hiddenSetting } = await clients.owner
      .from("app_settings")
      .select("key")
      .eq("key", privateSettingKey);
    expect(hiddenSetting).toHaveLength(0);

    for (const role of ["admin", "support"] as const) {
      const { data, error } = await clients[role]
        .from("app_settings")
        .select("key")
        .eq("key", privateSettingKey);
      expect(error, role).toBeNull();
      expect(data, role).toHaveLength(1);
    }
    for (const role of ["anon", "buyer"] as const) {
      const { data, error } = await clients[role]
        .from("app_settings")
        .select("key")
        .eq("key", privateSettingKey);
      expect(error, role).toBeNull();
      expect(data?.length ?? 0, role).toBe(0);
    }

    for (const role of ["anon", "buyer", "owner"] as const) {
      const { data } = await clients[role]
        .from("feature_flags")
        .select("key")
        .in("key", ["launch_mode", "interno_ip_allowlist"]);
      expect(
        data?.map((row) => row.key),
        role,
      ).toEqual(["launch_mode"]);
    }

    for (const role of ["admin", "support"] as const) {
      const { data, error } = await clients[role]
        .from("feature_flags")
        .select("key")
        .in("key", ["launch_mode", "interno_ip_allowlist"])
        .order("key");
      expect(error, role).toBeNull();
      expect(
        data?.map((row) => row.key),
        role,
      ).toEqual(["interno_ip_allowlist", "launch_mode"]);
    }

    for (const role of ["anon", "admin", "support", "owner", "buyer"] as const) {
      const client = clients[role];
      const probeKey = `${privateSettingKey}_${role}`;
      writeProbeKeys.push(probeKey);

      const insertSetting = await client
        .from("app_settings")
        .insert({ key: probeKey, value: '"forged"', public: false })
        .select("key");
      expect(
        insertSetting.error ?? insertSetting.data?.length,
        `insert settings ${role}`,
      ).toBeTruthy();

      const updateSetting = await client
        .from("app_settings")
        .update({ value: '"forged"' })
        .eq("key", privateSettingKey)
        .select("key");
      expect(updateSetting.error ?? updateSetting.data?.length, `settings ${role}`).toBeTruthy();

      const removeSetting = await client
        .from("app_settings")
        .delete()
        .eq("key", privateSettingKey)
        .select("key");
      expect(
        removeSetting.error ?? removeSetting.data?.length,
        `delete settings ${role}`,
      ).toBeTruthy();

      const insertFlag = await client
        .from("feature_flags")
        .insert({ key: probeKey, value: '"forged"' })
        .select("key");
      expect(insertFlag.error ?? insertFlag.data?.length, `insert flags ${role}`).toBeTruthy();

      const updateFlag = await client
        .from("feature_flags")
        .update({ value: '"post"' })
        .eq("key", privateSettingKey)
        .select("key");
      expect(updateFlag.error ?? updateFlag.data?.length, `flags ${role}`).toBeTruthy();

      const removeFlag = await client
        .from("feature_flags")
        .delete()
        .eq("key", privateSettingKey)
        .select("key");
      expect(removeFlag.error ?? removeFlag.data?.length, `delete flags ${role}`).toBeTruthy();
    }
  });

  it("RPCs de gestão limitam leitura por papel e escrita sensível exige PIN", async () => {
    const profileList = await clients.admin.rpc("admin_list_profiles", { p_limit: 1 });
    expect(profileList.error).toBeNull();
    expect(profileList.data!.length).toBeLessThanOrEqual(1);
    expect((await clients.support.rpc("admin_list_profiles", { p_limit: 1 })).error).not.toBeNull();
    expect(
      (await clients.owner.rpc("admin_profile_detail", { p_profile_id: ids.buyer })).error,
    ).not.toBeNull();

    const supportModeration = await clients.support.rpc("admin_list_moderation", {
      p_status: "pending_review",
      p_limit: 1,
    });
    expect(supportModeration.error).toBeNull();
    expect(
      (
        await clients.buyer.rpc("admin_list_moderation", {
          p_status: "pending_review",
          p_limit: 1,
        })
      ).error,
    ).not.toBeNull();

    const leads = await clients.admin.rpc("admin_list_site_leads", { p_limit: 1 });
    expect(leads.error).toBeNull();
    expect(
      (await clients.support.rpc("admin_list_site_leads", { p_limit: 1 })).error,
    ).not.toBeNull();

    const settingRead = await clients.admin.rpc("admin_app_settings");
    expect(settingRead.error).toBeNull();
    expect((await clients.support.rpc("admin_app_settings")).error).not.toBeNull();
    expect((await clients.owner.rpc("admin_feature_flags")).error).not.toBeNull();

    const noPin = await clients.admin.rpc("set_app_setting", {
      p_key: "company_name",
      p_value: '"PIN required test"',
    });
    expect(noPin.error?.hint).toBe("step_up_required");

    const moderationNoPin = await clients.admin.rpc("moderate_property", {
      p_property_id: propertyId,
      p_action: "approve",
      p_reason: null,
    });
    expect(moderationNoPin.error?.hint).toBe("step_up_required");

    const { data: previousSupportStepUp } = await service
      .from("staff_auth")
      .select("last_step_up_at")
      .eq("profile_id", ids.support)
      .maybeSingle();
    try {
      const granted = await service
        .from("staff_auth")
        .upsert(
          { profile_id: ids.support, last_step_up_at: new Date().toISOString() },
          { onConflict: "profile_id" },
        );
      expect(granted.error).toBeNull();

      const supportDecision = await clients.support.rpc("moderate_property", {
        p_property_id: propertyId,
        p_action: "approve",
        p_reason: null,
      });
      expect(supportDecision.error).not.toBeNull();
      expect(supportDecision.error?.hint).not.toBe("step_up_required");
    } finally {
      await service.from("staff_auth").upsert(
        {
          profile_id: ids.support,
          last_step_up_at: previousSupportStepUp?.last_step_up_at ?? null,
        },
        { onConflict: "profile_id" },
      );
    }
  });
});
