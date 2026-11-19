import { Skeleton, SkeletonCards } from "@upm/ui";

import { SectionHeadingLoading, SiteLoading } from "@/components/SiteLoading";

export default function Loading() {
  return (
    <SiteLoading>
      <div
        style={{
          display: "grid",
          gap: "var(--sp-6)",
          justifyItems: "center",
          paddingBlock: "var(--sp-9)",
        }}
      >
        <Skeleton width={160} height={14} />
        <Skeleton width="min(100%, 44rem)" height={56} radius="var(--r-xl)" />
        <Skeleton width="min(100%, 36rem)" height={56} radius="var(--r-xl)" />
        <Skeleton width="min(100%, 32rem)" height={16} />
        <div
          style={{
            display: "flex",
            gap: "var(--sp-4)",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Skeleton width={168} height="var(--h-xl)" radius="var(--r-lg)" />
          <Skeleton width={148} height="var(--h-xl)" radius="var(--r-lg)" />
        </div>
      </div>
      <SectionHeadingLoading align="center" />
      <SkeletonCards count={3} min={280} lines={3} />
    </SiteLoading>
  );
}
