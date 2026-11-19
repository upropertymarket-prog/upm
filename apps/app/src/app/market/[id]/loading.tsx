import { Skeleton, SkeletonCard } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <Skeleton width={120} height={14} />
      <div className="upm-split">
        <div style={{ display: "grid", gap: "var(--sp-7)", minWidth: 0 }}>
          <Skeleton height="min(56vw, 440px)" radius="var(--r-2xl)" />
          <Skeleton width="70%" height={30} radius="var(--r-lg)" />
          <Skeleton width="45%" height={16} />
          <SkeletonCard lines={5} />
        </div>
        <div style={{ display: "grid", gap: "var(--sp-6)", minWidth: 0 }}>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={4} />
        </div>
      </div>
    </ShellLoading>
  );
}
