import { cookies } from "next/headers";
import { createClient, obterUtilizador } from "@upm/db/server";
import { isThemeChoice, type ThemeChoice } from "@upm/ui";

/**
 * Lê `profiles.theme` do utilizador com sessão, para o script anti-flash poder
 * pintar o tema certo no primeiro paint (04 §5.2).
 *
 * Devolve `null` sem sessão: aí manda o `localStorage` e, se também não houver,
 * o `prefers-color-scheme`. Uma falha de leitura devolve `null` em vez de
 * rebentar — o tema é preferência, não pode derrubar o layout.
 */
export async function getServerThemeChoice(): Promise<ThemeChoice | null> {
  try {
    const supabase = createClient(await cookies());
    const {
      data: { user },
    } = await obterUtilizador(supabase);
    if (!user) return null;

    const { data } = await supabase
      .from("profiles")
      .select("theme")
      .eq("id", user.id)
      .maybeSingle();
    return isThemeChoice(data?.theme) ? data.theme : null;
  } catch {
    return null;
  }
}
