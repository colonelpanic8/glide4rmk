// Board facts live in one place (ADR 0037): a board's own knowledge (its id,
// matrix, keys, LEDs, groups, add-ons, Magic layer, what its RMK build keeps)
// is its profile in the registry, `src/model/boards/`; what a connected keyboard
// can do comes from its firmware, as capabilities. The simulated and offline
// boards stand in for firmware and may name their board. Anywhere else, code
// asks the registry or the capabilities: it never names a board, keeps a table
// for one, or branches on one. A shared Flow reads the board from its
// description (`$view.board`), never a table by board id.
//
// Text, not modules: prose that names a board (a comment, a message, a
// Flow's description) is fine; a board id as a value, an object key or a
// per-board table is not.

const BOARD_IDS = ["glove80", "go60"] as const;

/** Where board facts may be written down (and the guards, which name what they look for). */
const HOMES = ["src/model/boards/", "src/session/mock/", "src/session/offline/", "src/vendor/", "src/test/", "src/architecture/"];

/** Whether a source file is held to the rule: production code outside the board facts' homes. */
export function isBoardFactsChecked(path: string): boolean {
  return path.startsWith("src/") && !/\.test\.tsx?$/.test(path) && !HOMES.some((home) => path.startsWith(home));
}

/** The text without comments (line and block), so prose there never counts. */
function code(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

const ids = BOARD_IDS.join("|");
/** A board id as a string value or an object key, a per-board table, or a per-board file. */
const IN_CODE: Array<[RegExp, string]> = [
  [new RegExp(`["'\`](${ids})["'\`]`, "g"), "a board id as a value"],
  [new RegExp(`(?<![\\w.])(${ids})\\s*:`, "g"), "a board id as a key"],
  [/\b(GLOVE80|GO60)_[A-Z0-9_]+/g, "a board's own table"],
  [new RegExp(`model/boards/(${ids})\\b`, "g"), "a board's own file"],
];

export interface BoardFact {
  file: string;
  what: string;
  text: string;
}

/** Board facts written down outside their homes, in source files. */
export function findBoardFactsInCode(files: Readonly<Record<string, string>>): BoardFact[] {
  const found: BoardFact[] = [];
  for (const [file, text] of Object.entries(files)) {
    if (!isBoardFactsChecked(file)) continue;
    const body = code(text);
    for (const [pattern, what] of IN_CODE) for (const match of body.matchAll(pattern)) found.push({ file, what, text: match[0] });
  }
  return found;
}

/** A shared Flow's script (its comments left out) naming a board by id: it keeps a fact the description already gives. */
export function findBoardFactsInFlows(files: Readonly<Record<string, string>>): BoardFact[] {
  const found: BoardFact[] = [];
  for (const [file, text] of Object.entries(files)) {
    if (!file.startsWith("flows/shared/")) continue;
    const script = /script\s*=\s*'''([\s\S]*?)'''/.exec(text)?.[1] ?? "";
    const body = script.replace(/#.*$/gm, "");
    for (const match of body.matchAll(new RegExp(`\\b(${ids})\\b`, "g"))) found.push({ file, what: "a board id in a shared Flow's script", text: match[0] });
  }
  return found;
}
