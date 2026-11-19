import { Skeleton, SkeletonCard } from "@upm/ui";

import { SiteLoading } from "@/components/SiteLoading";

export default function Loading() {
  return (
    <SiteLoading>
      <Skeleton width={140} height={14} />
      <Skeleton height="min(60cqi, 520px)" radius="var(--r-2xl)" />
      <div className="upm-split">
        <div style={{ display: "grid", gap: "var(--sp-6)", minWidth: 0 }}>
          <Skeleton width="70%" height={34} radius="var(--r-lg)" />
          <Skeleton width="40%" height={18} />
          <SkeletonCard lines={6} />
        </div>
        <SkeletonCard lines={4} />
      </div>
    </SiteLoading>
  );
}
