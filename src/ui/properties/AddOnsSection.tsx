// Layout properties → Details → Add-ons (ADR 0028): what the keyboard has
// beyond keys. A built-in add-on (the Go60's touchpads) is shown as fitted; a
// module (the Glove80's touchpads) is switched on or off for this layout, kept
// in the layout file, one Undo step. A board without places shows nothing.

import { fittedAddOns, withPlace } from "../../model/boards/add-ons";
import { useWorkbench } from "../state";
import { BigSwitch } from "./BigSwitch";

export function AddOnsSection({ label }: { label: string }) {
  const { bundle, state, io } = useWorkbench();
  const places = bundle.boardProfile?.addOns ?? [];
  if (places.length === 0) return null;
  const fitted = new Set(fittedAddOns(places, state.modules).map(({ id }) => id));

  return (
    <>
      <span className={label}>Add-ons</span>
      <div className="flex flex-col gap-2">
        {places.map((place) =>
          place.builtIn ? (
            <div key={place.id} className="flex items-baseline justify-between rounded-xl border border-line bg-raised px-4 py-3">
              <span className="text-ui font-semibold text-ink">{place.label}</span>
              <span className="text-small text-mute">Built in</span>
            </div>
          ) : (
            <BigSwitch
              key={place.id}
              name={place.label}
              state={fitted.has(place.id) ? `Fitted: the ${place.noun} module, saved with this layout` : `Not fitted`}
              on={fitted.has(place.id)}
              onChange={(on) => io.setModules(withPlace(places, state.modules, place, on))}
            />
          ),
        )}
      </div>
    </>
  );
}
