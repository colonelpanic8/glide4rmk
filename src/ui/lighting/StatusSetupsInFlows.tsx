// Where RGB Lighting's Advanced points to the status setups that became Flows
// (ADR 0035): on a board that has them, a button that opens Flows at
// "Looks & lighting".

import { openFlows } from "../flows/store";
import { MarqueeIcon } from "../icons";
import { Button, SectionLabel } from "../kit";
import { useWorkbench } from "../state";

export const LIGHTING_FLOWS = "Looks & lighting";

export function StatusSetupsInFlows() {
  const { bundle } = useWorkbench();
  if (!bundle.boardProfile?.presets.includes("glove80-status")) return null;
  return (
    <div>
      <SectionLabel>Status setups</SectionLabel>
      <Button className="mt-2 w-full" onClick={() => openFlows(LIGHTING_FLOWS)}>
        <MarqueeIcon size={12} /> {bundle.boardProfile.name}'s status setups in Flows
      </Button>
    </div>
  );
}
