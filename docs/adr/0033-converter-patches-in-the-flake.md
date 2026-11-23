# 0033. Changes to the MoErgo converter travel as patches in the flake

**Status:** Accepted. First used for MoErgo JSON export of tap patterns (todo 30).

## Context

The MoErgo converter (`moergo-config`, built into `moergo-config-wasm`) belongs to `colonelpanic8/moergo-rmk`, which this repository pins in `flake.nix`. Saving a layout as MoErgo JSON failed on any tap pattern, macro or user key, and the fix belongs in that converter. A change there cannot always land upstream before GLIDE4RMK needs it, and a fork of `moergo-rmk` would have to follow its submodules (`dependencies/rmk`) and its release history as well.

## Decision

- **A converter change this repository needs before upstream has it is a `git format-patch` commit in `nix/patches/`,** listed in `moergoRmkPatches` in `flake.nix` and applied in order on top of the pinned `moergo-rmk` when the WASM client is built. Each patch is the commit to send upstream, tests included, so the converter's own suite runs on it there.
- **The pin does not move for a patch.** It stays on an upstream commit; the patch names the change. When the pin moves past a patch's commit, the patch and its list entry go in the same change.
- **The client says it is patched:** `build-rev.json` in the built package lists the patches beside the pinned revision.
- **CI builds the patched client as it builds any:** the patches are under `nix/`, so they are part of the WASM key (`scripts/wasm-key.mjs`), and a pull request that changes one rebuilds the clients it tests with.

## Consequences

- GLIDE4RMK can ship a converter fix without waiting for upstream or keeping a fork, and the fix is ready to offer upstream as it stands.
- A session without Nix runs the tests against the clients on `ci/vendor-wasm-out`, which are the unpatched ones until the change that adds a patch is merged; such a session cannot check that change's tests locally.
- A patch that no longer applies to a new pin fails the WASM build, which is the signal to rebase it or drop it.
