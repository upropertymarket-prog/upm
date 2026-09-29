import type { Metadata } from "next";

import { AuthCard, AuthPage } from "../../../components/auth/AuthLayout";
import { NewPasswordForm } from "./NewPasswordForm";
import { setNewPassword } from "../actions";

export const metadata: Metadata = {
  title: "Definir nova palavra-passe · UProperty Market",
};

export default function ConfirmNewPasswordPage() {
  return (
    <AuthPage>
      <AuthCard>
        <NewPasswordForm action={setNewPassword} />
      </AuthCard>
    </AuthPage>
  );
}
