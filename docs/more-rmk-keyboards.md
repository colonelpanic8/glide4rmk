# More RMK keyboards (parked)

**Status:** Parked, 2026-11-23. What it would take for GLIDE4RMK to work with RMK keyboards beyond the Glove80 and Go60. Nothing here is decided; the first step is a conversation, not code.

## 1. The protocol decides it

GLIDE4RMK speaks Rynk as `colonelpanic8/rmk` (branch `assembled`, pinned in `flake.nix`) builds it. Upstream RMK (`rmk-rs/rmk`) has Rynk too, but the two have drifted. Read from both on 2026-11-23 (fork `6b1ac3d`, upstream `19590a8`):

- **Versions:** the fork is Rynk 0.2, upstream 0.3. While the major version is 0, hosts require an exact match (`rmk-types/src/protocol/rynk/mod.rs`).
- **The handshake already differs:** upstream's `DeviceCapabilities` has two more fields (`max_connections`, `dongle_profile`; `max_morses` where the fork has `max_morse`), and hosts reject trailing response bytes.
- **The fork has about three times upstream's commands:** lighting, pointing, layer names and layer state, modifier state, tap-hold profiles, behavior options, the split link and maintenance mode are fork-only. One command id clashes: `0x0706` is `DisconnectBleProfile` upstream and `GetSplitCentralLatency` in the fork.
- **Opening a keyboard needs `GetLayerState`** (`workbench/open.ts`), which upstream does not have.
- **Most RMK keyboards run Vial,** RMK's default; Rynk is experimental there and mutually exclusive with Vial. Upstream's docs also say browser USB is not available yet for Rynk (WebHID over Bluetooth only); whether GLIDE4RMK's USB connection depends on the fork is not checked.

The choices:

- **Upstream the fork's protocol additions** into `rmk-rs/rmk`: every RMK keyboard built with Rynk then works. Needs colonelpanic8 and RMK's maintainers; not work in this repo.
- **A second client for upstream Rynk**, chosen at the handshake, with what it lacks shown as missing capabilities and a connect that does without layer state. Medium to large, and it follows an unstable protocol.
- **Vial**: a second protocol and its own project; left out.

## 2. What already works once a board speaks GLIDE4RMK's protocol

- **Its shape:** the firmware sends its physical layout (`GetLayout`), so the board draws itself without a profile.
- **No RGB:** screens follow the capabilities; a board without lighting hides Lighting (the simulated Plain 36).
- **Rotary encoders:** from the firmware's layout, drawn and editable (the simulated stub 48 and Ortho 60).
- **Trackballs, trackpoints, touchpads:** their settings work without a profile (listed as "Device 0" …); only their place on the canvas comes from a profile (the Go60's pads). Either each profile gives positions, or the firmware's layout learns to carry them.
- **Displays (OLED):** RMK drives them, but neither protocol has a command for them, so there is nothing to configure until the firmware exposes something (a renderer, a logo).

## 3. Per board, once 1 is settled

A profile in `model/boards/profiles/` (name, labels, key groups for the Flows, pointing positions, add-ons, firmware targets), one small PR a board, and a simulated board when it brings new hardware, so the smoke test covers it. A board without a profile still works, without key groups and the Flows that need them.

Candidates: the RMK ports RMK's README lists (ZSA Moonlander, Planck EZ and Voyager, Urchin, Lunakbd, sessile, dactyl-lynx …). The ZSA boards fit OMA, whose users already have Oryx layouts.

## Order

Settle the protocol with colonelpanic8 first; without it nothing reaches a real keyboard. Then profiles one board at a time, pointing positions as boards need them; displays wait for the firmware. Nothing here was tried on a keyboard other than the MoErgo boards.
