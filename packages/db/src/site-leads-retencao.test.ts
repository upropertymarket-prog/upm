import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

/**
 * A purga dos 30 dias é só das pré-inscrições (8 nov 2026, 20261108120000)
 * =========================================================================
 * Só a pré-inscrição pede confirmação por e-mail. Até esta data, a purga dos
 * "por confirmar" apagava também os pedidos de contacto e de empresas com
 * mais de 30 dias — que nunca confirmam, porque ninguém lho pede.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const hasEnv = Boolean(SUPABASE_URL && SERVICE_ROLE_KEY);

describe.skipIf(!hasEnv)("purge_unconfirmed_site_leads — contra a base", () => {
  it("apaga a pré-inscrição por confirmar com 30 dias, e não o pedido de contacto", async () => {
    const service = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
    const carimbo = Date.now();
    const antigo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    const base = { source: "pre_launch", profile_type: "buyer", status: "new", created_at: antigo };

    const { data: leads, error } = await service
      .from("site_leads")
      .insert([
        {
          ...base,
          form: "preinscricao",
          name: "Retenção pré",
          email: `ret-pre-${carimbo}@upropertymarket.test`,
        },
        {
          ...base,
          form: "contacto",
          name: "Retenção contacto",
          email: `ret-contacto-${carimbo}@upropertymarket.test`,
        },
      ])
      .select("id, form");
    expect(error).toBeNull();
    const pre = leads!.find((l) => l.form === "preinscricao")!.id;
    const contacto = leads!.find((l) => l.form === "contacto")!.id;

    try {
      const { error: purgeError } = await service.rpc("purge_unconfirmed_site_leads");
      expect(purgeError).toBeNull();

      const { data: restam } = await service
        .from("site_leads")
        .select("id")
        .in("id", [pre, contacto]);
      expect((restam ?? []).map((l) => l.id)).toEqual([contacto]);
    } finally {
      await service.from("site_leads").delete().in("id", [pre, contacto]);
    }
  });
});
