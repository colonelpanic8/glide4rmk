// A layout file opened without a keyboard, on the board it is for: a Go60
// file as a Go60, a Glove80 file as a Glove80. Its lights are lowered against
// that board's LEDs. A file for another board opens nothing. (Importing into
// a connected keyboard is `readImport`, which converts to that keyboard.)

import { parseDocument, type ParsedConfig } from "../../config/document";
import { documentBoard } from "../../config/document-board";
import type { MoErgoBoard } from "../../model/boards/transfer";
import type { RynkSession } from "../types";
import { offlineCatalog, offlineTopology, openOfflineBoard, type OfflineBoardOptions } from "./board";

export interface OfflineDocument {
  board: MoErgoBoard;
  session: RynkSession;
  /** The file as parsed; none for a new file. */
  parsed: ParsedConfig | null;
}

/** Opens `text` on its own board, or a new Glove80 layout when there is no
 *  file. The config wasm must be initialised. */
export function openOfflineDocument(text: string | null, options?: OfflineBoardOptions): OfflineDocument {
  if (text === null) return { board: "glove80", session: openOfflineBoard("glove80", undefined, options), parsed: null };
  const board = documentBoard(text);
  const parsed = parseDocument(text, offlineCatalog(board), offlineTopology(board));
  return { board, session: openOfflineBoard(board, parsed.snapshot, options), parsed };
}
