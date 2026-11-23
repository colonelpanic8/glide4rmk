// The eight modifiers as toggles, left hand above right, each written the way
// the chosen computer writes it (keyface/modifiers.ts): ⌘ Command on a Mac,
// ⊞ Windows on Windows, Super on Linux.

import type { ModifierCombination } from "../../model/action-types";
import { cx } from "../kit";
import { MODIFIER_ORDER, modifierLook } from "../keyface/modifiers";
import { useOs } from "../preferences";

const SIDES = [
  { side: "left", label: "L" },
  { side: "right", label: "R" },
] as const;

export function ModGrid({
  mods,
  onChange,
}: {
  mods: ModifierCombination;
  onChange: (next: ModifierCombination) => void;
}) {
  const os = useOs();
  const fields = SIDES.flatMap(({ side, label }) =>
    MODIFIER_ORDER.map((modifier) => {
      const look = modifierLook(modifier, os);
      return { key: `${side}_${modifier}` as keyof ModifierCombination, symbol: look.symbol, label: `${label} ${look.word}` };
    }),
  );
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {fields.map((f) => (
        <button
          key={f.key}
          type="button"
          aria-pressed={mods[f.key]}
          onClick={() => onChange({ ...mods, [f.key]: !mods[f.key] })}
          className={cx(
            "flex cursor-pointer flex-col items-center rounded-md border py-1.5 transition-colors duration-120",
            mods[f.key]
              ? "border-accent bg-accent-dim/40 text-accent"
              : "border-line bg-raised text-mute hover:border-line-strong",
          )}
        >
          <span className="text-ui leading-none">{f.symbol}</span>
          <span className="mt-0.5 text-caption uppercase tracking-wide">{f.label}</span>
        </button>
      ))}
    </div>
  );
}
