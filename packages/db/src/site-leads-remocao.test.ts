import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

/**
 * Apagar a pré-inscrição pelo link do e-mail — contra a base (8 nov 2026)
 * =========================================================================
 * `remove_site_lead` (20261108100000) apaga o lead, as notas da equipa sobre
 * ele e a confirmação na fila, e deixa no `audit_log` só o id. Aqui
 * verifica-se tudo isso, com o cliente `anon` — o mesmo do site.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

describe.skipIf(!hasEnv)("remove_site_lead — contra a base", () => {
  it("apaga o lead, as notas e a confirmação na fila, e só uma vez", async () => {
    const service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const anon = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } });
    const email = `remocao-${Date.now()}@upropertymarket.test`;

    const { data: lead, error: leadError } = await service
      .from("site_leads")
      .insert({
        source: "pre_launch",
        form: "preinscricao",
        name: "Teste Remoção",
        email,
        profile_type: "buyer",
        status: "new",
      })
      .select("id")
      .single();
    expect(leadError).toBeNull();

    const token = randomBytes(32).toString("hex");
    await service
      .from("site_leads")
      .update({ removal_token_hash: createHash("sha256").update(token).digest("hex") })
      .eq("id", lead!.id);
    // Uma nota da equipa (prendia o lead com `restrict`) e a confirmação na fila.
    const { error: eventError } = await service
      .from("site_lead_events")
      .insert({ lead_id: lead!.id, kind: "note", body: "Ligar à tarde" });
    expect(eventError).toBeNull();
    await service.from("notification_deliveries").insert({
      channel: "email",
      recipient: email,
      template: "site_lead_confirmation",
      payload: { title: "Confirme" },
      status: "cancelled",
    });

    // Um token inventado não apaga nada.
    const errado = await anon.rpc("remove_site_lead", { p_token: "b".repeat(64) });
    expect(errado.data).toBe(false);

    const { data, error } = await anon.rpc("remove_site_lead", { p_token: token });
    expect(error).toBeNull();
    expect(data).toBe(true);

    const [leads, events, deliveries, audit] = await Promise.all([
      service.from("site_leads").select("id").eq("id", lead!.id),
      service.from("site_lead_events").select("id").eq("lead_id", lead!.id),
      service.from("notification_deliveries").select("id").eq("recipient", email),
      service
        .from("audit_log")
        .select("action, diff")
        .eq("entity_id", lead!.id)
        .eq("action", "site_lead.removed_by_request"),
    ]);
    expect(leads.data).toEqual([]);
    expect(events.data).toEqual([]);
    expect(deliveries.data).toEqual([]);
    expect(audit.data).toHaveLength(1);
    // O registo não guarda quem era.
    expect(JSON.stringify(audit.data)).not.toContain(email);
    expect(JSON.stringify(audit.data)).not.toContain("Teste Remoção");

    // O mesmo link, outra vez: já não serve.
    const outraVez = await anon.rpc("remove_site_lead", { p_token: token });
    expect(outraVez.data).toBe(false);
  });
});
