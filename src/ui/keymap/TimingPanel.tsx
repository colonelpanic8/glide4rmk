// The key editor's timing panel, opened by the gear on a slot, as GLIDE opens a
// hold-tap's settings: the timing that decides this key's hold or tap pattern,
// with its fields (TimingFields). A timing other keys share is copied for this
// key only, unless asked to change it for all of them; the copy is named after
// the original and the key (operations/key-timing.ts). A tap-hold can also
// pick another profile here.

import { useState } from "react";
import type { KeyAction } from "../../model/action-types";
import { copyName, keyTiming } from "../../model/key-behavior";
import { withProfile } from "../../model/key-slots";
import { same } from "../../model/deep-equal";
import { labelAt, namesOf } from "../../model/behavior-labels";
import { useWorkbench } from "../state";
import { useTerms, useWording } from "../terms";
import { showToast } from "../messages/store";
import { Button } from "../kit";
import { ProfileSelect } from "./ProfileSelect";
import { TimingFields } from "../behaviors/editor/TimingFields";
import { LIBRARY_KINDS } from "../behaviors/library";

export function TimingPanel({
  layer,
  row,
  col,
  action,
  keyName,
  onClose,
}: {
  layer: number;
  row: number;
  col: number;
  action: KeyAction;
  /** The key's place (`LH-C4R3`): a copy's name ends in it. */
  keyName: string;
  onClose: () => void;
}) {
  const { state, io } = useWorkbench();
  const term = useTerms();
  const wording = useWording();
  const timing = keyTiming(action, state);
  const [draft, setDraft] = useState(() => structuredClone(timing?.profile));
  const shared = timing !== null && timing.source.kind !== "default" && timing.users > 1;
  // Changing one key is what the key editor is for: a shared timing is copied unless asked.
  const [onlyThisKey, setOnlyThisKey] = useState(true);
  if (!timing || !draft) return null;

  const { source } = timing;
  const name =
    source.kind === "profile" ? source.name : source.kind === "morse" ? (labelAt(state.labels, "morse", source.index)?.name ?? "") : "";
  const kind = LIBRARY_KINDS[source.kind === "morse" ? "morse" : "profiles"].one[wording];
  const copies = source.kind === "default" || (shared && onlyThisKey);
  const tapHold = typeof action === "object" && "TapHold" in action ? action.TapHold : null;
  const taken = source.kind === "morse" ? namesOf(state.labels, "morse") : state.morseProfiles.map((entry) => entry.name);
  const copied = copyName(name, keyName, taken);
  const changed = !same(draft, timing.profile);

  const apply = async () => {
    const done = await io.apply("set_key_timing", { layer, row, col, timing: draft, only_this_key: copies, key_name: keyName });
    if (!done.ok) {
      showToast(`Timing not changed: ${done.message}`, { tone: "danger" });
      return;
    }
    showToast(copies ? `This key now has its own timing: ${copied}` : `Timing changed for ${shared ? `all ${timing.users} keys` : "this key"}`, { tone: "ok" });
    onClose();
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-accent/40 bg-raised p-3" aria-label="Timing">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-body font-semibold text-ink">{term("morse.timing")}</span>
        <span className="truncate font-mono text-small text-mute">{name || "Keyboard default"}</span>
      </div>
      {tapHold && <ProfileSelect value={tapHold[2]} onChange={(profile) => void io.setKey(layer, row, col, withProfile(action, profile))} />}
      <TimingFields value={draft} onChange={setDraft} />
      {shared && (
        <fieldset className="flex flex-col gap-1.5 text-body text-ink">
          <label className="flex cursor-pointer items-start gap-2">
            <input type="radio" checked={onlyThisKey} onChange={() => setOnlyThisKey(true)} className="mt-0.5 accent-(--color-accent)" />
            <span>
              Only this key
              <span className="block font-mono text-small text-mute">New {kind.toLowerCase()}: {copied}</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2">
            <input type="radio" checked={!onlyThisKey} onChange={() => setOnlyThisKey(false)} className="mt-0.5 accent-(--color-accent)" />
            <span>All {timing.users} keys that use {name || `this ${kind.toLowerCase()}`}</span>
          </label>
        </fieldset>
      )}
      {source.kind === "default" && <p className="text-small text-mute">Saved as a new {kind.toLowerCase()}: <span className="font-mono">{copied}</span></p>}
      <div className="flex gap-2">
        <Button variant="primary" className="flex-1" disabled={!changed} reason="Change a field first" onClick={() => void apply()}>
          Apply
        </Button>
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
