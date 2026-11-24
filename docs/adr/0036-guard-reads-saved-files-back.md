# 0036. Guard reads every saved file back

**Status:** Accepted. Builds on ADR 0011 (Guard) and ADR 0033 (converter patches).

## Context

GLIDE4RMK must never save a file it cannot open. It did: the converter wrote a mod-tap without a timing profile as `MT(KC_ENT,RAlt)` and read two-part `MT` only modifier first, so a saved Go60 layout was refused on import (fixed in #47). Guard judged every change to the layout (ADR 0011) but not a save: `exportDocument` rendered the file and handed it over unread, and every round-trip test started from a file someone wrote by hand, never from what the app saves.

## Decision

- **A save reads its file back first.** `exportChecked` (`config/transfer.ts`) renders the file as `exportDocument` does, then `checkSaved` (`config/saved-check.ts`) parses it with the reader that opens files and compares what it reads back as with the snapshot it was rendered from. The comparison covers what the format holds (MoErgo JSON: the keymap and the behaviors; TOML: everything), after setting aside what a file does not keep: unused slots after the last one in each table, the trackpads' revision counter, the scene table's order, the prior-idle time the keyboard reports twice, fields left unset.
- **Guard speaks for it.** A file the reader refuses is never saved: a Guard note, "Nothing was saved: GLIDE4RMK could not open this … file again (…)". A file that opens as something else is a Guard question, the differences behind Show details (a layer and key, or the part: the lights, the combos …), with Save anyway and Don't save (`savedFileWords`, `ui/guard/words.ts`).
- **A test saves every layout the app knows.** `workbench/saved-files.test.ts` saves the simulated Glove80 and every test fixture in each format its board writes and requires the check to pass; MoErgo JSON's own refusal of keys it cannot express is the one other outcome allowed. A new fixture is covered by adding it to the harness.

## Consequences

- A converter change that breaks a round trip fails Checks, and one that slips through stops at the save, not at the next import.
- Reading back costs one parse in the browser per save; nothing reaches the keyboard.
- `exportDocument` stays for callers that want the text alone (tests, migration); the save action uses `exportChecked`.
- What the check sets aside is listed in one place (`saved-check.ts`); a new kind of loss found later is either fixed in the converter or, if a file rightly does not keep it, added there with its reason.
