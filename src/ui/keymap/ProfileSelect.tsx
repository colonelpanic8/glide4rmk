// Which tap-hold profile a tap-hold uses: the keyboard's default or one of the
// named profiles (each with its timing in its tooltip).

import { DEFAULT_TAP_HOLD_PROFILE } from "../../model/morse";
import { useWorkbench } from "../state";
import { useWording } from "../terms";
import { morseProfileSummary } from "../morse-profile";
import { LIBRARY_KINDS } from "../behaviors/library";

export function ProfileSelect({ value, onChange }: { value: number; onChange: (profile: number) => void }) {
  const { state } = useWorkbench();
  const wording = useWording();
  return (
    <label className="flex items-center justify-between gap-3 text-body text-mute">
      {LIBRARY_KINDS.profiles.one[wording]}
      <select
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="max-w-44 rounded-lg border border-line bg-well px-2 py-1 text-body text-ink"
      >
        <option value={DEFAULT_TAP_HOLD_PROFILE}>Keyboard default</option>
        {state.morseProfiles.map((entry) => (
          <option key={entry.index} value={entry.index} title={morseProfileSummary(entry.profile)}>
            {entry.name}
          </option>
        ))}
      </select>
    </label>
  );
}
