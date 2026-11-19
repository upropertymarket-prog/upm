import { SkeletonHeader, SkeletonSplit } from "@upm/ui";

import { ShellLoading } from "../../components/loading";

export default function Loading() {
  return (
    <ShellLoading fill>
      <SkeletonHeader divider />
      <SkeletonSplit
        separate
        panes={[
          { basis: "320px", kind: "list" },
          { basis: "420px", kind: "reader" },
        ]}
      />
    </ShellLoading>
  );
}
