# 0026. The key editor names the behavior, edits its timing, and shows a fork's double tap

**Status:** Accepted. Follows GLIDE's slot editor (`dev/ui/slotEditor.jsx` in glide-src: a behavior's settings open from a gear on its slot); builds on ADR 0019 (operations) and ADR 0020 (the Behavior Library).

## Context

The key editor showed a key's slots and, for a plain tap-hold, a "Hold timing" list of profiles. It did not say which behavior the key was bound to, could not change a timing (only pick another profile), showed nothing for a morse key's own timing, and missed what a fork adds: TailorKey's shiftdance is a tap pattern (tap: sticky Shift, hold: Shift) plus a fork on the same key (Shift active: Caps Lock), so tapping twice gives Caps Lock, but the editor showed On Double Tap as empty and offered to add one.

## Decision

- **A behavior line above the slots** (`ui/keymap/KeyBehavior.tsx`) for anything but a plain key: the kind (Tap-hold, Morse / Tap pattern, Layer-mod-tap), its name, its timing and how many keys share it, and the forks that fire on the key. What a binding is made of is pure: `model/key-behavior.ts`.
- **A fork can be the double tap.** When a key's tap is a sticky modifier and a fork on the key turns a press made while that modifier is active into one action, that action is the key's On Double Tap, marked "via" the fork (`forkDoubleTap`). Changing it changes the fork's output; removing it deletes the fork. It does not swap with the other slots. Any other fork stays in the behavior line.
- **Timing opens from a gear** on the slot it decides (On Hold, else On Double Tap or On Tap), as in GLIDE: the timing fields of the profile or tap pattern, and for a tap-hold the choice of profile (`ui/keymap/TimingPanel.tsx`). The "Hold timing" list is gone from the key editor; combos keep the profile choice.
- **Changing one key changes one key.** A timing other keys share is copied for this key by default, with "All N keys" as the other choice; the keyboard's default timing, once changed, becomes a profile of the key's own. The copy is named after the original and the key's place, so the two read as related: `HRM_index_v1_TK_LH_C4R3` (`copyName`: letters, digits and `_`, at most 32 characters, `_2` when taken). The forks on the key are copied with it, so the copy keeps its double tap. All of it is one operation, `set_key_timing` (`operations/key-timing.ts`): judged once by Guard, one Undo step, in Draft until Send.

## Consequences

- The same copying keeps a morse key whole when one of its slots changes (`planSlotWrites` copies the forks on a shared entry).
- A fork with one trigger serves every key bound to the same tap pattern: changing a fork-made double tap changes it on all of them. The behavior line says how many keys share the pattern.
- Keys are counted on every layer; a combo or fork output that uses a profile is not counted as a key sharing it.
