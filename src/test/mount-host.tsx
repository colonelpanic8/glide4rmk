// The workbench a mounted screen lives in (mount.tsx): what the test harness
// opened, as React state, with the one history and the document transfer, as
// the app's Workbench provides them; its stores end with it.

import { useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import type { WorkbenchIo } from "../workbench";
import { useHistory } from "../ui/draft/useHistory";
import { WorkbenchContext } from "../ui/state";
import { DocumentTransferContext, useDocumentTransfer } from "../ui/transfer-actions";
import { endWorkbench } from "../ui/workbench-store";
import type { TestWorkbench } from "./harness";

/** Shares the workbench's document transfer, as the app's Workbench does. */
function Transfer({ children }: { children: ReactNode }) {
  return <DocumentTransferContext value={useDocumentTransfer()}>{children}</DocumentTransferContext>;
}

export function MountHost({ bench, io, children }: { bench: TestWorkbench; io: WorkbenchIo; children: ReactNode }) {
  const state = useSyncExternalStore(bench.subscribe, bench.state, bench.state);
  const history = useHistory(state, io, bench.dispatch);
  // As in the app: the workbench's stores end with it.
  useEffect(() => endWorkbench, []);
  const value = useMemo(() => ({ bundle: bench.bundle, state, dispatch: bench.dispatch, io, history }), [bench, state, io, history]);
  return (
    <WorkbenchContext value={value}>
      <Transfer>{children}</Transfer>
    </WorkbenchContext>
  );
}

