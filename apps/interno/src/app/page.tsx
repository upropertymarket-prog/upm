import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@upm/db/server";

export default async function InternalIndexPage() {
  const supabase = createClient(await cookies());
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.role === "support") {
    // The support mailbox is a planned route in the internal navigation; its page lands in a later phase.
    redirect("/suporte/email" as never);
  }
  redirect("/admin/painel");
}
