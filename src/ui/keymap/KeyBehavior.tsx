// The key editor's behavior line, above the slots, as GLIDE names the behavior
// a key is bound to: what kind it is, its name, its timing, how many keys share
// it, and the forks that change it (the one that is the key's double tap shows
// as On Double Tap instead). A plain key has no line.

import type { KeyAction } from "../../model/action-types";
import { keyForks, keyTiming } from "../../model/key-behavior";
import { labelAt } from "../../model/behavior-labels";
import { useWorkbench } from "../state";
import { useTerms, useWording } from "../terms";
import { useKeyText } from "../useKeyText";
import { morseProfileSummary } from "../morse-profile";
import { LIBRARY_KINDS } from "../behaviors/library";
import { modifierText } from "../keyface/modifiers";

export function KeyBehavior({ action, doubleTapFork }: { action: KeyAction; doubleTapFork: number | null }) {
  const { state } = useWorkbench();
  const term = useTerms();
  const wording = useWording();
  const keyText = useKeyText();
  if (typeof action !== "object" || "Single" in action || "Tap" in action) return null;

  const timing = keyTiming(action, state);
  const forks = keyForks(action, state.forks).filter((index) => index !== doubleTapFork);
  const forkWord = LIBRARY_KINDS.forks.one[wording];
  let kind: string;
  let name: string;
  if ("Morse" in action) {
    kind = LIBRARY_KINDS.morse.one[wording];
    name = labelAt(state.labels, "morse", action.Morse)?.name || `${kind} ${action.Morse}`;
  } else if ("TapHold" in action) {
    kind = term("behavior.tapHold");
    name = timing?.source.kind === "profile" ? timing.source.name : "Keyboard default timing";
  } else {
    kind = term("behavior.layerModTap");
    name = keyText.describe(action);
  }
  const shared = timing && timing.users > 1 ? ` · on ${timing.users} keys` : "";

  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-line-soft bg-well/60 px-3 py-2" aria-label="Behavior">
      <div className="flex items-baseline gap-1.5">
        <span className="shrink-0 text-small font-semibold text-mute">{kind}</span>
        <span className="truncate font-mono text-small text-ink">{name}</span>
      </div>
      {timing && (
        <span className="truncate text-small text-mute">
          {morseProfileSummary(timing.profile)}
          {shared}
        </span>
      )}
      {forks.map((index) => {
        const fork = state.forks[index];
        const when = modifierText(fork.match_any.modifiers, keyText.os) || "its condition";
        return (
          <span key={index} className="truncate text-small text-mute">
            {forkWord} {labelAt(state.labels, "forks", index)?.name || index}: with {when}, {keyText.glyph(fork.positive_output).text || "nothing"}
          </span>
        );
      })}
    </div>
  );
}
