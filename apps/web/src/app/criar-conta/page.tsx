import type { Metadata } from "next";

import { RegisterWizard } from "./RegisterWizard";
import { registerAccount } from "./actions";

export const metadata: Metadata = {
  title: "Criar conta · UProperty Market",
};

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
      <RegisterWizard action={registerAccount} />
    </main>
  );
}
