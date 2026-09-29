import type { Metadata } from "next";

import { AuthPage } from "../../components/auth/AuthLayout";
import { RegisterWizard } from "./RegisterWizard";
import { registerAccount } from "./actions";

export const metadata: Metadata = {
  title: "Criar conta · UProperty Market",
};

export default function RegisterPage() {
  return (
    <AuthPage>
      <RegisterWizard action={registerAccount} />
    </AuthPage>
  );
}
