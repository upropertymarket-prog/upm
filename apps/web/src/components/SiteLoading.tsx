import { useTranslations } from "next-intl";
import { Skeleton, SkeletonField, SkeletonPage } from "@upm/ui";

import { AuthShell } from "@/components/auth/AuthLayout";
import { SiteSection } from "@/components/site/SiteSection";
import { HeaderLoading } from "./HeaderLoading";

/**
 * Esqueletos do site público — o que os `loading.tsx` desenham (19 nov 2026)
 * =========================================================================
 * Três molduras, uma por família de página: as do site (barra + secção), as
 * de autenticação (o `AuthShell` verdadeiro) e os documentos legais (uma
 * coluna de leitura, sem barra). Cada `loading.tsx` põe dentro a forma do
 * seu ecrã.
 */
export function SiteLoading({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common");
  return (
    <>
      <HeaderLoading />
      <main>
        <SiteSection>
          <SkeletonPage label={t("loading")} gap="var(--sp-8)">
            {children}
          </SkeletonPage>
        </SiteSection>
      </main>
    </>
  );
}

/** O título de uma secção do site: eyebrow, título, corpo. */
export function SectionHeadingLoading({ align = "left" }: { align?: "left" | "center" }) {
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--sp-4)",
        justifyItems: align === "center" ? "center" : "start",
      }}
    >
      <Skeleton width={96} height={12} />
      <Skeleton width="min(100%, 30rem)" height={36} radius="var(--r-lg)" />
      <Skeleton width="min(100%, 38rem)" height={14} />
    </div>
  );
}

export function AuthLoading({ fields = 2 }: { fields?: number }) {
  const t = useTranslations("common");
  const ts = useTranslations("auth.shell");
  return (
    <AuthShell legalLabel={ts("legal")} privacyLabel={ts("privacy")} cookiesLabel={ts("cookies")}>
      <SkeletonPage label={t("loading")} gap="var(--sp-7)">
        <div style={{ display: "grid", gap: "var(--sp-4)" }}>
          <Skeleton width="65%" height={32} radius="var(--r-lg)" />
          <Skeleton width="90%" height={14} />
        </div>
        {Array.from({ length: fields }, (_, i) => (
          <SkeletonField key={i} />
        ))}
        <Skeleton height="var(--h-md)" radius="var(--r-lg)" />
      </SkeletonPage>
    </AuthShell>
  );
}

export function LegalLoading() {
  const t = useTranslations("common");
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16">
      <SkeletonPage label={t("loading")} gap="var(--sp-4)">
        <Skeleton width="55%" height={30} radius="var(--r-lg)" />
        <Skeleton width={200} height={12} />
        <div style={{ display: "grid", gap: "var(--sp-4)", marginTop: "var(--sp-8)" }}>
          {Array.from({ length: 14 }, (_, i) => (
            <Skeleton key={i} width={i % 5 === 4 ? "60%" : "100%"} height={12} />
          ))}
        </div>
      </SkeletonPage>
    </main>
  );
}
