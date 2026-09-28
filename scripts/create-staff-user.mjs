#!/usr/bin/env node
/**
 * Bootstrap de conta de staff (07 §6) — não há registo público em interno.*,
 * a conta é criada pelo admin. Este script usa a service_role (fora do git,
 * em .secrets/supabase.env) para criar o utilizador auth + profiles +
 * staff_members numa só chamada.
 *
 * Uso:
 *   set -a && . .secrets/supabase.env && set +a
 *   node scripts/create-staff-user.mjs --email=alguem@upropertymarket.pt \
 *     --name="Nome Completo" --role=admin --department=admin
 *
 * --role: admin | support (05 §6.1 profiles.role)
 * --department: suporte | financeiro | moderacao | admin (05 §6.1 staff_members)
 *
 * Depois do primeiro login (com a password temporária impressa no fim), o
 * `middleware.ts` de interno força a ativação do 2FA TOTP antes de qualquer
 * outra coisa (07 §6).
 */
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function parseArgs() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((arg) => {
      const [key, ...rest] = arg.replace(/^--/, "").split("=");
      return [key, rest.join("=")];
    }),
  );
  return args;
}

const args = parseArgs();
const { email, name, role = "admin", department = "admin" } = args;

if (!email || !name) {
  console.error("Uso: node scripts/create-staff-user.mjs --email=... --name=\"...\" [--role=admin|support] [--department=...]");
  process.exit(1);
}
if (!["admin", "support"].includes(role)) {
  console.error("--role tem de ser admin ou support.");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("Faltam NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  console.error('Corra primeiro: set -a && . .secrets/supabase.env && set +a');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const temporaryPassword = randomBytes(12).toString("base64url");

const { data: created, error: createError } = await supabase.auth.admin.createUser({
  email,
  password: temporaryPassword,
  email_confirm: true, // staff não passa pela verificação por e-mail de 07 §5.9
  user_metadata: { full_name: name, role },
});

if (createError || !created.user) {
  console.error(`Falha a criar o utilizador: ${createError?.message}`);
  process.exit(1);
}

// O trigger handle_new_user (base.sql) já criou profiles com role='buyer' por
// omissão — corrige para o papel de staff pedido.
const { error: profileError } = await supabase
  .from("profiles")
  .update({ role, status: "active" })
  .eq("id", created.user.id);

if (profileError) {
  console.error(`Utilizador criado, mas falhou a atualizar profiles: ${profileError.message}`);
  process.exit(1);
}

const { error: staffError } = await supabase
  .from("staff_members")
  .insert({ profile_id: created.user.id, department, title: "" });

if (staffError) {
  console.error(`Utilizador e profile prontos, mas falhou staff_members: ${staffError.message}`);
  process.exit(1);
}

console.log(`Conta de staff criada: ${email} (${role}, ${department})`);
console.log(`Password temporária (mude no primeiro login): ${temporaryPassword}`);
console.log("Próximo login em interno.* vai forçar a ativação do 2FA TOTP (07 §6).");
