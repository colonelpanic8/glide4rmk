// Status setups on keys picked on the board, in Layout properties' RGB
// Lighting tab under Advanced: a connection key and a battery bar
// (StatusKeyPicks.tsx), on any keyboard with lit keys. MoErgo's setups are
// Flows (ADR 0035). One key's status light is set on the key itself (its RGB
// Lighting tab).

import { useState } from "react";
import { SectionLabel } from "../kit";
import { useCapabilities } from "../use-capabilities";
import { layerName } from "../layer-names";
import { useDevice, useWorkbench } from "../state";
import { StatusKeyPicks } from "./StatusKeyPicks";
import { layersInMask } from "../../model/lighting/wake-layers";

const selectClass = "mt-1 w-full rounded-md border border-line bg-raised px-2 py-1.5 text-body text-ink";

export function StatusPresetsPanel() {
  const { bundle, state } = useWorkbench();
  const device = useDevice();
  const capabilities = useCapabilities();
  const numLayers = bundle.caps.num_layers;
  const wakeLayers = state.lightingOutputMode?.wake_layers ?? state.lightingControls.wake_layers;
  const [wakeLayer] = layersInMask(wakeLayers, numLayers);
  // Follow the current wake policy until a layer is chosen.
  const [chosenLayer, setChosenLayer] = useState<number | null>(null);
  const layer = chosenLayer !== null && chosenLayer < numLayers ? chosenLayer : (wakeLayer ?? device.currentLayer);

  if (!capabilities.has("lighting.rules")) return null;
  if (!bundle.model.keys.some((key) => key.ledId !== undefined)) return null;
  const nameOf = (n: number) => layerName(state.layerMetadata, n);

  return (
    <div>
      <SectionLabel>Status setup</SectionLabel>
      <label className="mt-2 block text-small text-faint">
        On the layer
        <select value={layer} onChange={(event) => setChosenLayer(Number(event.target.value))} className={selectClass}>
          {Array.from({ length: numLayers }, (_, index) => (
            <option key={index} value={index}>
              {nameOf(index)}
              {index === wakeLayer ? " · wakes the lights" : ""}
            </option>
          ))}
        </select>
      </label>
      <StatusKeyPicks layer={layer} connections={capabilities.has("lighting.rules.connection")} />
    </div>
  );
}
