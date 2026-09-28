import type { Metadata } from "next";

import { PinSetupForm } from "./PinSetupForm";

export const metadata: Metadata = {
  title: "Segurança · Definições · UProperty Market Interno",
};

export default function SecuritySettingsPage() {
  return (
    <main className="mx-auto w-full max-w-md px-4 py-16">
      <div className="rounded-2xl border border-border bg-surface p-6">
        <PinSetupForm />
      </div>
    </main>
  );
}
