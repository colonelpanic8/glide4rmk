import type { ExtensionCatalog, ImportNote, RuntimeSnapshot } from "./document";
import { parseDocument, renderDocument } from "./document";
import { boardForMatrix, boardForSnapshot, transferSnapshot } from "../model/boards/transfer";
import type { MoErgoBoard } from "../model/boards/transfer";
import { profileById } from "../model/boards/profiles";

export interface MigrationDraft {
  text: string;
  target: MoErgoBoard;
  notes: ImportNote[];
}

/** Make a standalone peer-board document without carrying destination state. */
export function migrationDraft(source: RuntimeSnapshot, catalog: ExtensionCatalog): MigrationDraft {
  const board = boardForSnapshot(source);
  // Each board's profile names where its layouts migrate to (model/boards/).
  const from = profileById(board.id);
  const to = from?.documents?.migrationTarget && profileById(from.documents.migrationTarget.id);
  if (!from || !to) throw new Error(`No migration is registered for the ${board.name}.`);
  const target = boardForMatrix(to.matrix.rows, to.matrix.cols);
  const empty: RuntimeSnapshot = {
    ...source,
    rows: target.rows,
    cols: target.cols,
    layers: source.layers.map(() => Array.from(
      { length: target.rows * target.cols },
      (_, offset) => target.physical.has(`${Math.floor(offset / target.cols)},${offset % target.cols}`)
        ? "Transparent" as const : "No" as const,
    )),
    lighting: undefined,
    behaviors: undefined,
    pointing: undefined,
  };
  const result = transferSnapshot(source, target.rows, target.cols, empty);
  result.snapshot.bluetooth_name = undefined;
  const notes = [...result.notes];
  // A board without built-in trackpads gets none of their settings: its touchpads are modules a layout turns on.
  if (!to.addOns?.some((place) => place.kind === "pointing" && place.builtIn)) {
    if (result.snapshot.pointing) {
      notes.push({ location: "Pointing", message: `${from.name} trackpad settings are omitted on ${to.name}.`, approximated: false });
      result.snapshot.pointing = undefined;
    }
    if (result.snapshot.behaviors?.auto_mouse_layers?.length) {
      notes.push({ location: "Auto-mouse layers", message: `${from.name} automatic pointing layers are omitted on ${to.name}.`, approximated: false });
      result.snapshot.behaviors.auto_mouse_layers = undefined;
    }
  }
  result.snapshot.behaviors ??= {
    config: undefined, options: undefined, morse_profiles: undefined,
    hold_trigger_positions: undefined, auto_mouse_layers: undefined,
    morses: undefined, combos: undefined, forks: undefined, macros: undefined,
  };
  const text = renderDocument(result.snapshot, catalog, "toml");
  parseDocument(text, catalog);
  return { text, target: target.id, notes };
}
