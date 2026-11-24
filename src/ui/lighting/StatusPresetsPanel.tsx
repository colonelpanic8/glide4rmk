// Status setups, in Layout properties' RGB Lighting tab under Advanced: on a
// Glove80, MoErgo's stock Magic layer; on any keyboard with lit keys, a
// connection key and a battery bar on keys picked on the board
// (StatusKeyPicks.tsx). The Glove80 status cluster is a Flow (ADR 0035). One
// key's status light is set on the key itself (its RGB Lighting tab).

import { useState } from "react";
import type { KeyView } from "../../model/keyboard";
import { SectionLabel } from "../kit";
import { useCapabilities } from "../use-capabilities";
import { layerName } from "../layer-names";
import { useDevice, useWorkbench } from "../state";
import { StatusKeyPicks } from "./StatusKeyPicks";
import { useTerms } from "../terms";
import { StockMagicLayerPanel } from "./StockMagicLayerPanel";
import { stockMagicIndicatorKeys } from "../../model/lighting/stock-magic-layer";
import { layersInMask } from "../../model/lighting/wake-layers";

const selectClass = "mt-1 w-full rounded-md border border-line bg-raised px-2 py-1.5 text-body text-ink";

function keyAt(keys: KeyView[], row: number, col: number): KeyView | undefined {
  return keys.find((key) => key.row === row && key.col === col);
}

export function StatusPresetsPanel() {
  const { bundle, state } = useWorkbench();
  const device = useDevice();
  const term = useTerms();
  const capabilities = useCapabilities();
  const numLayers = bundle.caps.num_layers;
  const wakeLayers = state.lightingOutputMode?.wake_layers ?? state.lightingControls.wake_layers;
  const [wakeLayer] = layersInMask(wakeLayers, numLayers);
  const preferredLayer = bundle.boardProfile?.defaultStatusLayer;
  const defaultLayer = wakeLayer ?? (preferredLayer !== undefined && preferredLayer < numLayers ? preferredLayer : device.currentLayer);
  // Follow the current wake policy until a layer is chosen.
  const [chosenLayer, setChosenLayer] = useState<number | null>(null);
  const layer = chosenLayer !== null && chosenLayer < numLayers ? chosenLayer : defaultLayer;

  if (!capabilities.has("lighting.rules")) return null;

  const nameOf = (n: number) => layerName(state.layerMetadata, n);
  const magicSupported = capabilities.has("lighting.rules.indicators");
  const stockMagicAvailable =
    bundle.boardProfile?.presets.includes("glove80-stock-magic") &&
    numLayers > 2 &&
    stockMagicIndicatorKeys().every((indicator) => keyAt(bundle.model.keys, indicator.row, indicator.col)?.ledId === indicator.led);
  const lit = bundle.model.keys.some((key) => key.ledId !== undefined);
  if (!stockMagicAvailable && !lit) return null;

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

      {stockMagicAvailable && magicSupported && <StockMagicLayerPanel layer={layer} />}
      {stockMagicAvailable && !magicSupported && (
        <p className="mt-2 text-small leading-relaxed text-warn">{term("magic.needsFirmware")}</p>
      )}
      {lit && <StatusKeyPicks layer={layer} connections={capabilities.has("lighting.rules.connection")} />}
    </div>
  );
}
