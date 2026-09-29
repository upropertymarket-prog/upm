import type { Metadata } from "next";

import { AuthCard, AuthPage } from "../../components/auth/AuthLayout";
import { RequestForm } from "./RequestForm";
import { requestPasswordReset } from "./actions";

export const metadata: Metadata = {
  title: "Recuperar palavra-passe · UProperty Market",
};

export default function RequestPasswordResetPage() {
  return (
    <AuthPage>
      <AuthCard>
        <RequestForm action={requestPasswordReset} />
      </AuthCard>
    </AuthPage>
  );
}
