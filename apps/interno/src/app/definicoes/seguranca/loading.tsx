import { useTranslations } from "next-intl";
import { Skeleton, SkeletonField, SkeletonPage } from "@upm/ui";

/** O PIN de operação: um cartão estreito, sem shell, como a página. */
export default function Loading() {
  const t = useTranslations("common");
  return (
    <main className="flex min-h-dvh w-full items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6">
        <SkeletonPage label={t("loading")}>
          <Skeleton width="55%" height={22} radius="var(--r-md)" />
          <Skeleton width="90%" height={12} />
          <SkeletonField />
          <SkeletonField />
          <Skeleton width={140} height="var(--h-sm)" radius="var(--r-lg)" />
        </SkeletonPage>
      </div>
    </main>
  );
}
