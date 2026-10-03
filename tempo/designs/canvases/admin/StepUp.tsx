import { NextIntlClientProvider } from "next-intl";
import { ThemeProvider } from "../../../../packages/ui/src/theme/ThemeProvider";
import { StepUpModal } from "../../../../apps/interno/src/components/StepUpModal";
import type { VerifyPinAction } from "../../../../apps/interno/src/components/stepUpTypes";
import ptMessages from "../../../../packages/config/messages/pt.json";
import { AdminPlanosClaro, AdminPlanosEscuro } from "./Billing";

const verifyPin: VerifyPinAction = async () => ({ ok: true });

function AdminStepUpDemo({ theme }: { theme: "light" | "dark" }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ThemeProvider initialChoice={theme}>
        <div data-theme={theme} style={{ minHeight: "900px", background: "var(--bg)" }}>
          {theme === "light" ? <AdminPlanosClaro /> : <AdminPlanosEscuro />}
          <StepUpModal
            open={true}
            onClose={() => undefined}
            onConfirmed={() => undefined}
            onVerify={verifyPin}
          />
        </div>
      </ThemeProvider>
    </NextIntlClientProvider>
  );
}

export function AdminStepUpClaro() {
  return <AdminStepUpDemo theme="light" />;
}

export function AdminStepUpEscuro() {
  return <AdminStepUpDemo theme="dark" />;
}
