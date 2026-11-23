# GLIDE parity ledger

What GLIDE4RMK took from GLIDE, feature by feature: GLIDE's files (in `moosylog/glide-src`, the source; `moosylog/glide` holds only builds), GLIDE4RMK's, and the GLIDE commit last ported. A port reads one diff instead of two codebases: `scripts/glide-since.sh <feature>` prints GLIDE's commits on that feature's files since that commit, with their `DEVLOG.md` lines. The ledger is also the list of what is left (`docs/architecture-review.md`, "5. GLIDE parity").

**How the commit was found.** No GLIDE4RMK commit or ADR names a GLIDE commit, so the column is derived: *Port* is the newest GLIDE4RMK commit that says it takes this feature from GLIDE (its message or its ADR), and *GLIDE commit* is the newest `glide-src` commit on GLIDE's files for the feature made before that port. A port may have read an older GLIDE, never a newer one. Where no port names the feature, the commit is `unknown` and the script prints the files' whole history.

**When you port.** Read `scripts/glide-since.sh <feature>`, port what matters, then set the row's GLIDE commit to `glide-src`'s newest commit on those files (`git -C ../glide-src log -1 --format=%h -- <files>`) and its Port to your commit's PR. A new feature gets a row; files are paths from each repository's root, space-separated in backticks, and a folder stands for everything in it.

| Feature | What | GLIDE files | GLIDE4RMK files | GLIDE commit | Port |
| --- | --- | --- | --- | --- | --- |
| `flows-store` | Flows store | `dev/ui/flowScreens.jsx` `dev/ui/flowModals.jsx` `dev/ui/flowActions.js` `dev/flows` `docs/specs/flows.md` `docs/specs/ui/flows.md` | `src/ui/flows` `src/operations/flows` `src/workbench/flows.ts` `flows` | 90596d6 | 2d0bb97 |
| `key-editor` | Key editor tabs and slots | `dev/ui/inspector.jsx` `dev/ui/inspectorTabs.jsx` `dev/ui/slotEditor.jsx` `dev/ui/keyDetails.jsx` `dev/ui/holdTapBuilders.jsx` `docs/specs/ui/key-editor.md` | `src/ui/keymap/KeyEditor.tsx` `src/ui/keymap/KeyBehavior.tsx` `src/ui/keymap/EditorPanel.tsx` | 0ff3355 | 8269015 |
| `behavior-library` | Behavior library | `dev/ui/behaviorLists.jsx` `dev/ui/behaviorEditor.jsx` `dev/ui/behaviorUsage.jsx` `dev/ui/behaviorActions.js` `docs/specs/ui/behaviors.md` | `src/ui/behaviors` | f6de792 | 3cb591c |
| `macro-builder` | Macro builder | `dev/ui/macroEditor.jsx` | `src/ui/behaviors/editor/MacroSteps.tsx` `src/ui/behaviors/editor/MacroStepList.tsx` | 460db92 | c3f3348 |
| `add-ons` | Add-ons | `dev/core/boards/addons.js` `dev/ui/touchpadModal.jsx` `docs/specs/keyboards.md` | `src/ui/properties/ModulesKeeper.tsx` `src/model/boards` | a685f3d | 0b00d74 |
| `combo-focus` | Combos in Focus Mode | `dev/ui/comboOverlay.jsx` `dev/ui/keyCombos.jsx` `dev/ui/comboMenu.jsx` | `src/ui/keymap/ComboFocusCanvas.tsx` `src/ui/keymap/ComboEditor.tsx` `src/ui/keymap/useComboFocus.ts` `src/model/combos.ts` | e28abf1 | bc801b7 |
| `side-panel` | Side panel (layers) | `dev/ui/sidebar.jsx` `dev/ui/layerMenu.jsx` `dev/ui/layerActions.js` `docs/specs/ui/side-panel.md` | `src/ui/sidepanel` | c1ed713 | bf8f2aa |
| `top-bar` | Top bar | `dev/ui/topBar.jsx` `docs/specs/ui/top-bar.md` | `src/ui/TopBar.tsx` | bcd4f32 | e4d539a |
| `canvas` | Canvas, key faces, key menu | `dev/ui/canvas.jsx` `dev/ui/keyFaceHtml.js` `dev/ui/keyHover.jsx` `dev/ui/keyMenu.jsx` `docs/specs/ui/canvas.md` | `src/ui/KeyboardCanvas.tsx` `src/ui/canvas` `src/ui/keyface` `src/ui/keymap/KeymapCenter.tsx` | fe417c5 | fb10e88 |
| `layout-properties` | Layout properties | `dev/ui/layoutProperties.jsx` `dev/ui/firmwareOptions.jsx` `docs/specs/ui/layout-properties.md` | `src/ui/properties` | 922f4bb | 10dee31 |
| `key-lighting` | Key lighting | `dev/ui/lightingTab.jsx` `dev/ui/ledView.jsx` `dev/ui/colorChoice.jsx` `dev/ui/keyColors.js` `dev/ui/lightingSettings.jsx` `docs/specs/lighting.md` | `src/ui/lighting` `src/ui/keymap/lightView.ts` `src/model/lighting` | 8ae7bab | 99107c5 |
| `themes-settings` | Themes and settings | `dev/core/themes.js` `dev/ui/themeEditor.jsx` `dev/ui/settingsPanel.jsx` `dev/ui/appearanceTab.jsx` | `src/ui/theme` `src/ui/SettingsPanel.tsx` `src/ui/preferences.ts` | f6de792 | 765427c |
| `guard` | Guard | `dev/ui/guard.jsx` `dev/core/capabilities/changeGuard.js` | `src/domain/guard.ts` `src/ui/guard` | fece887 | 1652c5a |
| `operations` | Operations | `dev/core/operations.js` | `src/operations/catalog.ts` | unknown | — |
| `board-geometry` | Glove80 geometry | `dev/core/boards/boards.generated.js` `dev/boards` | `src/model/boards` `src/session/mock/glove80.ts` | a685f3d | f64f7a1 |
| `flow-mirror-halves` | Mirror halves Flow | `dev/flows/shared/mirror-halves.flows` | `flows/shared/mirror-halves.flows` `src/model/boards/key-groups.ts` | 0e41d34 | #PR |

## Not ported yet

From GLIDE's `dev/ui/` with no row above: Check my layout (`dev/core/checks/`, `docs/specs/ui/check-my-layout.md`), printing (`printSheet.jsx`, `docs/specs/ui/print.md`), the Magic Clipboard (`groupClip.js`, `docs/specs/magic-clipboard.md`), conversions between boards and from other layouts (`convertBoard.jsx`, `convertOther.jsx`, `docs/specs/convert-mapping.md`), the code dock and custom code (`codeDock.jsx`, `customAction.jsx`), GitHub import (`githubImport.jsx`), ZMK Studio (`studio*.jsx`; GLIDE4RMK talks to RMK through its own session instead), quick tips and how-to videos (`quickTips.js`, `tipSearch.js`), the icon picker (`iconPicker.jsx`) and locales (`dev/core/locale/`).
