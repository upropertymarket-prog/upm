import { Skeleton, SkeletonTable } from "@upm/ui";

import { ShellLoading } from "../../components/loading";

export default function Loading() {
  return (
    <ShellLoading>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "var(--sp-6)" }}>
        <Skeleton width={120} height={18} radius="var(--r-md)" />
        <Skeleton width={130} height={14} />
      </div>
      <SkeletonTable rows={6} columns={5} card={false} />
    </ShellLoading>
  );
}
