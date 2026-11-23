import { useRef, useState } from "react";
import { Button } from "../kit";
import { useCapabilities } from "../use-capabilities";
import { layerName } from "../layer-names";
import { hasPendingConfigurationWrite } from "../../workbench";
import { useWorkbench } from "../state";
import { STOCK_PROFILE_KEYS, writeStockMagicLayer } from "../../model/lighting/stock-magic-layer";
import { useTerms } from "../terms";

export function StockMagicLayerPanel({ layer }: { layer: number }) {
  const { bundle, state, io, dispatch } = useWorkbench();
  const term = useTerms();
  const capabilities = useCapabilities();
  const ruleTable = capabilities.get("lighting.rules");
  const [message, setMessage] = useState<string | null>(null);
  const installing = useRef(false);
  const busy = hasPendingConfigurationWrite(state);
  const name = layerName(state.layerMetadata, layer);
  const profiles = Math.min(bundle.caps.num_ble_profiles, STOCK_PROFILE_KEYS.length);

  if (!ruleTable || !bundle.boardProfile?.presets.includes("glove80-stock-magic")) return null;

  const install = async () => {
    if (installing.current || busy || state.batchMode) return;
    installing.current = true;
    dispatch({ type: "lightingBusy", busy: true, error: null });
    setMessage(term("magic.installing"));
    try {
      const result = await writeStockMagicLayer(
        {
          setKey: (row, col, action) =>
            io.setKey(layer, row, col, action),
          applyScenes: (cells) => io.applyScenes(cells),
          applyRules: (rules) => io.applyConditionalScenes(rules),
          setWakeLayers: (mask) => io.setWakeLayers(mask),
        },
        {
          layer,
          numLayers: bundle.caps.num_layers,
          profiles,
          keys: bundle.model.keys,
          current: state.layers[layer],
          rules: state.runtimeConditionalDraft,
          ruleCapacity: ruleTable.slots,
          scenes: capabilities.has("lighting.scenes") ? state.scenes : null,
          sceneCapacity: capabilities.get("lighting.scenes")?.slots ?? 0,
          wakeLayers: state.lightingOutputMode?.wake_layers ?? null,
        },
      );
      setMessage(
        result.ok
          ? term("magic.installed", { layer: name, index: layer })
          : result.message,
      );
    } finally {
      installing.current = false;
      dispatch({ type: "lightingBusy", busy: false });
    }
  };

  return (
    <div className="mt-2 rounded-lg border border-accent-deep/40 bg-accent-dim/15 p-3">
      <div className="text-body font-medium text-ink">{term("magic.title")}</div>
      <p className="mt-1 text-small leading-relaxed text-faint">{term("magic.what", { layer: name, profiles })}</p>
      <p className="mt-1 text-small leading-relaxed text-faint">{term("magic.lights")}</p>
      {state.batchMode && <p className="mt-2 text-small text-warn">{term("magic.liveOnly")}</p>}
      <Button
        variant="primary"
        className="mt-2 w-full"
        disabled={busy || state.batchMode}
        onClick={install}
      >
        {term("magic.install", { layer: name })}
      </Button>
      {message && (
        <p role="status" className="mt-2 text-small leading-relaxed text-mute">
          {message}
        </p>
      )}
    </div>
  );
}
