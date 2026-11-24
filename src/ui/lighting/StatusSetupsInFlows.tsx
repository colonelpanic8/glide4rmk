// Where RGB Lighting's Advanced points to the status setups that are Flows
// (ADR 0035): on a board with MoErgo's Magic layer, a button that opens Flows
// at "Looks & lighting".

import { openFlows } from "../flows/store";
import { MarqueeIcon } from "../icons";
import { Button, SectionLabel } from "../kit";
import { useWorkbench } from "../state";
import { useTerms } from "../terms";

export const LIGHTING_FLOWS = "Looks & lighting";

export function StatusSetupsInFlows() {
  const { bundle } = useWorkbench();
  const term = useTerms();
  const profile = bundle.boardProfile;
  if (!profile?.magicLayer) return null;
  return (
    <div>
      <SectionLabel>Status setups</SectionLabel>
      <Button className="mt-2 w-full" onClick={() => openFlows(LIGHTING_FLOWS)}>
        <MarqueeIcon size={12} /> {term("lighting.setupsInFlows", { board: profile.name })}
      </Button>
    </div>
  );
}
