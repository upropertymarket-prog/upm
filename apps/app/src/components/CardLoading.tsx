import { useTranslations } from "next-intl";
import { Skeleton, SkeletonPage } from "@upm/ui";

/**
 * Esqueleto das duas páginas da app que vivem fora do shell — a conta
 * suspensa e a ligação de partilha: um cartão estreito ao centro do ecrã.
 */
export function CardLoading({ lines = 2 }: { lines?: number }) {
  const t = useTranslations("common");
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-4 py-16">
      <div className="upm-card upm-card--pad" style={{ width: "min(420px, 100%)" }}>
        <SkeletonPage label={t("loading")}>
          <Skeleton width="60%" height={24} radius="var(--r-md)" />
          {Array.from({ length: lines }, (_, i) => (
            <Skeleton key={i} width={i % 2 ? "70%" : "92%"} height={13} />
          ))}
          <Skeleton height="var(--h-md)" radius="var(--r-lg)" />
        </SkeletonPage>
      </div>
    </main>
  );
}
