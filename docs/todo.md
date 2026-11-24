# Todo

What is left to do, cheapest first within each group. Take one item per session; strike it in the same PR, with that PR's number (`#17`), which exists before the merge. What shipped is in the PRs and `git log`, not here. Decisions go in an ADR, not here.

## Architecture first (`docs/architecture-review.md`: "The plan, validated", then "Do now" and "Plan")

In this order; decisions in ADR 0017 and an update of ADR 0002.

1. ~~**A safety net.** Render tests for the RGB screens; a simulated board without RGB or Bluetooth; a test that opens every area and section on every simulated board.~~ `227ae02` (`ui/every-screen.test.tsx`).
2. ~~**A core for the workbench.** Reducer and `io` out of `ui/state.tsx` into `workbench/`; domain logic out of `ui/`; `docs/ARCHITECTURE.md`.~~ `1d035e0`, ADR 0017.
3. ~~**The draft holds the whole keyboard** (the rest of ADR 0013): macros, layer names and moves, settings; one history in Draft and Live.~~ ADR 0018.
4. **Operations.** ~~Image in, image out, judged by Guard, applied as one undo step; transforms onto them.~~ `85884ce`, ADR 0019; imports as a commit, ADR 0023. Left: the condition rules panel (item 11).
5. **Capabilities and `offer()`** for everything a screen offers; any time.
6. **The doors:** `describe(image)`, then Flows and WebMCP. Flows: ADR 0025, in the top bar; they know the board (ADR 0027): key groups, a jq library, `needs_keys`. Left: WebMCP behind a flag; `describe` grows with its readers; more GLIDE Flows (symbol layer, mouse, gaming); ~~the lighting setups as Flows and status lights on the key~~ #46, ADR 0035; key groups for boards the registry does not know (a profile each, or marked by the person and kept in the layout); the Glove80's touchpads drawn on the canvas when fitted.

## Cheap 

7. ~~**The clipboard write on a key click.** During browser checks the page wrote to the clipboard while only keys were clicked. Find out whether selecting a key triggers the copy handler; if so, clicking a key overwrites what you copied.~~ Not reproduced: no click, right-click or selecting gesture writes it, only Ctrl or ⌘ with C (`ui/keymap/clipboard.click.test.tsx`), #23.
8. ~~**Shorter stock Magic layer text** (RGB Lighting → Advanced): it still carries the old Lighting screen's long explanation, and tells you to "finish batch editing".~~ #24.
9. ~~**Words that outlived what they describe.** The Undo buttons' tooltip (`ui/TopBar.tsx`) says imports and transforms start the history over; neither does (ADR 0019, 0023). The review window (`ui/draft/ReviewWindow.tsx`) says combos, macros and settings go to the keyboard as you change them; in Draft they wait for Send.~~ #24.
10. ~~**Remove the overlay's leftover state.**~~ The overlay is Try out's now (`95de5d9`, ADR 0024).

## Medium

11. **Rule writes onto the one path (ADR 0012/0013).** The condition rules panel's Apply rules still writes the whole rule table at once, in either mode (`io.applyConditionalScenes`); the status setups are operations and Flows (ADR 0035, #46). Make Apply a `set_rules` commit, sent with everything else, then remove `io.applyConditionalScenes`.
12. ~~**Status setups are not atomic in Live.**~~ Each is one commit: the Glove80 status cluster and MoErgo's Magic layer as Flows, the rest as status lights on the key, #46, ADR 0035.
13. **Direct Live writes onto the one path.** One key, an encoder, a combo, morse or fork slot, behavior timing, hold-trigger positions, the default layer and the lighting controls are written through the session at once in Live, without a fresh read or the three-way check (`docs/sync.md`, "When the writer runs").
14. **ADR 0019's Realtime switch** for RGB Lighting and RGB Effects is not built.
15. **The macro region is written after the keys when it both shrinks and changes** (`sync/plan.ts`): keys already changed may run the new macros' slots before the region holds them. Write a reworked region before the keys, or split the write.
16. **A prior-idle time of 0 does not survive a TOML file.** The file cannot say 0; it reads back as the default, 120 ms (`io-import.test.ts` sets the simulated board to 120 to work around it). The fix is in the codec.
17. **Blink duty above 100 in old files.** A layout file saved before exports clamped the duty may hold 128; the firmware's layout-file reader (`rmk-config`) refuses more than 100. Whether GLIDE4RMK's own reader (`moergo-config-wasm`) refuses it too is not verified. Clamp on import, or say why the file is refused.
18. **The Profiles section in the editor shell (ADR 0020).** The library and All your behaviors open a profile in the shell, but the Profiles section (`ui/ProfilesMode.tsx`) still has its own form and the only editor for a profile's positional hold triggers. Fold the keys in as a card, with Apply one operation (`update_behavior` taking the positions too), and make the section the kind's list.
19. **The older combo editor.** Behaviors → Combos is still the old `ui/advanced/CombosTab.tsx` beside the keymap's combo focus (side panel list, `ComboEditor`). It is the only place to choose whether a combo matches actions or positions (the keymap makes position combos) and to see every combo at once. Decide what moves to the keymap and remove the tab.
20. **Layer reachability after the Usage screen.** All your behaviors replaced the read-only Usage list, and with it the per-layer list (bound keys, what turns a layer on, unreachable layers). Guard still stops a change that cuts a layer off; decide whether the layer list returns, in the layer manager.
21. ~~**Behavior rows light their keys.** GLIDE lights the keys that use a behavior while its row is hovered; GLIDE4RMK does not yet.~~ The library's rows light the keys on the layer shown (`ui/behaviors/hoveredBehavior.ts`); tap timing profiles do not yet, as their row has no places.
22. **Paste keeps references between pasted behaviors.** A copied tap pattern that runs a copied macro still names the macro's old slot after Paste.
23. **Touch has no drag-select.** Selecting by dragging relies on `pointerenter` while a button is held, which a touch pointer, captured by the key it started on, does not give other keys. With Select on, touch can still select one tap at a time. Not tried on a device.

27. **Discarding a layer change in Review & send** reverts the layers and the keys, encoders and lights of the layers that moved, but not other references the change rewrote (combos, tap patterns, settings that name a layer), which stay in their own groups. Fold those in too, or discard them with it.
28. **Key decorations.** GLIDE gives keys a colour and a label (a binding's `decoration` in MoErgo JSON); GLIDE4RMK does not keep them yet, so an imported GLIDE layout loses them, with a note (`config/decorations.ts`). Keep them beside the keys, as behavior labels and add-ons are (ADR 0020, 0028), and show them on the canvas; decide whether a colour also becomes the key's light.
29. **Maintenance mode and the split link, live.** The session reads both (`session.device.maintenanceMode()`, `splitTransport()`), and rules can test them, but no topic carries them, so the workbench neither reads nor keeps them (#34). If a screen or a rules preview needs them, read them at connect into `state.device` and refresh them (on `LightingChange`, say); until then rules on them preview as unknown.
30. ~~**MoErgo JSON cannot be saved with tap patterns or user keys.** Export to MoErgo JSON stops with "runtime action TD(0) cannot be represented by the MoErgo editor JSON format" (or `USER(13)`) as soon as one key is a tap pattern or a user key. Opening a MoErgo or GLIDE layout with home-row mods works (its hold-taps become tap patterns), but saving it back as MoErgo JSON then fails; TailorKey and the simulated Glove80's stock layout (its Bluetooth keys) cannot be exported as MoErgo JSON at all. TOML is not affected. The refusal is the MoErgo converter's (`moergo-config-wasm`, built from `colonelpanic8/moergo-rmk`, `flake.nix`), so the fix starts there: write a tap pattern as a hold-tap behavior and a user key as what MoErgo calls it, or say which keys stop the export. It also blocks running GLIDE's Flows unchanged (`docs/architecture-review.md`, P6).~~ #41, ADR 0033.

32. **A new Go60 layout.** A file opens on the board it is for (ADR 0034), but New layout on the start screen still makes a Glove80: offer the Go60 there too (`openOfflineBoard("go60")` is ready; the button and the untitled name are in `App.tsx` and `ui/ConnectScreen.tsx`).

33. **The Go60's fourth Bluetooth key from MoErgo JSON.** MoErgo's Go60 layouts select four profiles; the Go60's RMK firmware has three and renumbers its `USER` actions after them, so importing the factory layout puts `USER(3)` (next profile) where MoErgo had profile 4. The converter's Go60 import (`nix/patches/moergo-rmk-go60-moergo-json.patch`) should map a fourth profile to nothing, with a note, or to what MoErgo's key means on RMK.

## Parked

31. **More RMK keyboards.** What it would take, and why the protocol decides it: `docs/more-rmk-keyboards.md`. Waits on a conversation with colonelpanic8 about upstreaming the fork's Rynk additions.

## Tests and trying it

24. **Try this branch in a browser and on a keyboard.** Several keys selected, picking keys, the effects gallery, exact timing, Try out, whole-row writes, imports as commits and Live's own send have only been tested in the simulated boards; none has been tried in a browser or on a keyboard.
25. ~~**Screen tests that interact.** Every screen test renders static markup; none clicks. Send, drag-swap, the selection gestures and the pick flow are untested at screen level.~~ #21, ADR 0030.
26. ~~**`DraftKeeper`'s effect** (Live's own send, the kept draft's flush) is untested; only its gate (`liveSendDue`) is.~~ #21.
