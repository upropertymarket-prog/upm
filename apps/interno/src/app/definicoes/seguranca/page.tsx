import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { PinSetupForm } from "./PinSetupForm";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("meta.interno");
  return { title: t("security") };
}

export default function SecuritySettingsPage() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
        <PinSetupForm />
      </div>
    </main>
  );
}
