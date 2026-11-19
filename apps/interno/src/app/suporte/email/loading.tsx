import { SkeletonSplit } from "@upm/ui";

import { ShellLoading } from "../../../components/loading";

export default function Loading() {
  return (
    <ShellLoading fill>
      <SkeletonSplit
        panes={[
          { basis: "220px", kind: "rail" },
          { basis: "360px", kind: "list" },
          { basis: "420px", kind: "reader" },
        ]}
      />
    </ShellLoading>
  );
}
