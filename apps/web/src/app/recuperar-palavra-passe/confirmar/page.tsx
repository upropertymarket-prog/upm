import type { Metadata } from "next";

import { NewPasswordForm } from "./NewPasswordForm";
import { setNewPassword } from "../actions";

export const metadata: Metadata = {
  title: "Definir nova palavra-passe · UProperty Market",
};

export default function ConfirmNewPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        <NewPasswordForm action={setNewPassword} />
      </div>
    </main>
  );
}
