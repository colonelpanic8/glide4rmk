// Which keyboard a layout file is for, read from the file before it is parsed:
// a file opens on its own board, so its keys, lights and trackpads land where
// that board has them. The rule is the converter's (moergo-config-wasm), read
// here first because parsing a file needs that board's catalog and lights.

import { parse } from "smol-toml";
import type { MoErgoBoard } from "../model/boards/transfer";

const BOARD_NAMES: Record<string, MoErgoBoard> = { glove80: "glove80", go60: "go60" };

/** MoErgo layer lengths, for a file that names no keyboard (as the converter reads it). */
const BOARD_BY_LAYER_LENGTH: Record<number, MoErgoBoard> = { 80: "glove80", 60: "go60", 62: "go60" };

/** TOML matrix shapes; a file without `rows`/`cols` is a 6x14 Glove80. */
const BOARD_BY_SHAPE: Record<string, MoErgoBoard> = { "6x14": "glove80", "5x14": "go60" };

const refuse = (board: string): Error =>
  new Error(`this file is for ${board}; only Glove80 and Go60 layouts open here`);

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
    const board = BOARD_NAMES[name.toLowerCase()];
    if (!board) throw refuse(`the keyboard "${name}"`);
    return board;
  }
  const first = Array.isArray(layout.layers) ? layout.layers[0] : undefined;
  return Array.isArray(first) ? BOARD_BY_LAYER_LENGTH[first.length] : undefined;
}

function tomlBoard(text: string): MoErgoBoard | undefined {
  let root: JsonObject;
  try {
    root = parse(text);
  } catch {
    return undefined;
  }
  const rows = root.rows ?? 6;
  const cols = root.cols ?? 14;
  const shape = `${String(rows)}x${String(cols)}`;
  const board = BOARD_BY_SHAPE[shape];
  if (!board) throw refuse(`a ${shape} keyboard`);
  return board;
}

/** The board a layout file is for. Throws, naming the board, for a file a
 *  Glove80 or Go60 cannot open; a file too broken to tell is a Glove80's, and
 *  its parse says what is wrong. */
export function documentBoard(text: string): MoErgoBoard {
  const json = text.trimStart().startsWith("{");
  return (json ? jsonBoard(text) : tomlBoard(text)) ?? "glove80";
}
