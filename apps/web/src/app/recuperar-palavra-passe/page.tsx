import type { Metadata } from "next";

import { RequestForm } from "./RequestForm";
import { requestPasswordReset } from "./actions";

export const metadata: Metadata = {
  title: "Recuperar palavra-passe · UProperty Market",
};

export default function RequestPasswordResetPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
      <div className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-border bg-surface p-6">
        <RequestForm action={requestPasswordReset} />
      </div>
    </main>
  );
}
