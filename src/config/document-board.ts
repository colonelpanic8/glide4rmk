// Which keyboard a layout file is for, read from the file before it is parsed:
// a file opens on its own board, so its keys, lights and trackpads land where
// that board has them. The rule is the converter's (moergo-config-wasm), read
// here first because parsing a file needs that board's catalog and lights. What
// tells the boards apart (their ids, matrices and MoErgo JSON layer lengths) is
// each board's profile in the registry (model/boards/).

import { parse } from "smol-toml";
import { BOARD_PROFILES } from "../model/boards/profiles";
import type { MoErgoBoard } from "../model/boards/transfer";

/** The boards whose files GLIDE4RMK reads. */
const FILE_BOARDS = BOARD_PROFILES.filter((profile) => profile.documents?.codec === "moergo");
const named = (name: string) => FILE_BOARDS.find((profile) => profile.id === name.toLowerCase())?.id as MoErgoBoard | undefined;
const withLayerLength = (length: number) =>
  FILE_BOARDS.find((profile) => profile.documents!.moergoLayerLengths.includes(length))?.id as MoErgoBoard | undefined;
const shaped = (rows: unknown, cols: unknown) =>
  FILE_BOARDS.find((profile) => profile.matrix.rows === rows && profile.matrix.cols === cols)?.id as MoErgoBoard | undefined;

/** A file too broken to tell is opened as the first board's, and its parse says what is wrong. */
const FALLBACK = FILE_BOARDS[0].id as MoErgoBoard;

const refuse = (board: string): Error =>
  new Error(`this file is for ${board}; only ${FILE_BOARDS.map((profile) => profile.name).join(" and ")} layouts open here`);

type JsonObject = Record<string, unknown>;
const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function jsonBoard(text: string): MoErgoBoard | undefined {
  let root: unknown;
  try {
    root = JSON.parse(text);
  } catch {
    return undefined; // the parser says what is wrong with it
  }
  if (!isObject(root)) return undefined;
  const layout = isObject(root.keymap) ? root.keymap : root;
  if (typeof layout.keyboard === "string") {
    const name = layout.keyboard.trim();
    const board = named(name);
    if (!board) throw refuse(`the keyboard "${name}"`);
    return board;
  }
  const first = Array.isArray(layout.layers) ? layout.layers[0] : undefined;
  return Array.isArray(first) ? withLayerLength(first.length) : undefined;
}

function tomlBoard(text: string): MoErgoBoard | undefined {
  let root: JsonObject;
  try {
    root = parse(text);
  } catch {
    return undefined;
  }
  // The converter reads a file without `rows`/`cols` as 6x14.
  const rows = root.rows ?? 6;
  const cols = root.cols ?? 14;
  const board = shaped(rows, cols);
  if (!board) throw refuse(`a ${String(rows)}x${String(cols)} keyboard`);
  return board;
}

/** The board a layout file is for. Throws, naming the board, for a file none
 *  of these boards can open; a file too broken to tell is opened as the first
 *  board's, and its parse says what is wrong. */
export function documentBoard(text: string): MoErgoBoard {
  const json = text.trimStart().startsWith("{");
  return (json ? jsonBoard(text) : tomlBoard(text)) ?? FALLBACK;
}
