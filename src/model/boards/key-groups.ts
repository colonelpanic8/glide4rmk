// Where the keys a Flow or a tool cares about sit on a board, by name: the
// letter block, the home row with each key's finger, the thumbs, the number and
// function rows. A board's profile carries its groups, so a Flow asks for
// `home_row` and works on every board that has one instead of keeping its own
// table of rows and columns (ADR 0027). A board without groups (a plain RMK
// board GLIDE4RMK knows nothing about) has none, and a Flow that needs them is
// not offered there. Pure data.

export type Hand = "left" | "right";
export type Finger = "pinky" | "ring" | "middle" | "index" | "thumb";

/** One key in a group: its matrix place, and the hand and finger that press it. */
export interface KeySpot {
  row: number;
  col: number;
  hand: Hand;
  finger: Finger;
}

export interface KeyGroups {
  /** The letter block: three rows of keys per hand, row by row (top, home,
   *  bottom), each row left hand then right hand, outer column first on the
   *  left and inner column first on the right: reading order. */
  letters: readonly KeySpot[];
  /** The home-row keys that take home-row mods, left pinky to right pinky. */
  home_row: readonly KeySpot[];
  /** The thumb keys, left hand then right. */
  thumbs: readonly KeySpot[];
  /** The number row (above the letters), reading order. */
  numbers: readonly KeySpot[];
  /** The function-key row, reading order; empty when the board has none. */
  function: readonly KeySpot[];
  /** The keys below the letter block, outside the thumb clusters, reading order;
   *  empty when the board has none. With the other groups, every key once. */
  bottom: readonly KeySpot[];
}

export type KeyGroupName = keyof KeyGroups;
export const KEY_GROUP_NAMES: readonly KeyGroupName[] = ["letters", "home_row", "thumbs", "numbers", "function", "bottom"];

/** A finger by column, outer to inner, for a hand of six columns (an outer
 *  pinky column, pinky, ring, middle, two index columns). */
const SIX_COLUMNS: readonly Finger[] = ["pinky", "pinky", "ring", "middle", "index", "index"];

/** Keys of one row, left hand then right, in reading order: `left` and `right`
 *  are matrix columns, `right` from the inner column out, so a key's finger is
 *  its column's counted from the outer edge of a six-column hand. */
function rowOf(row: number, left: readonly number[], right: readonly number[], cols: number): KeySpot[] {
  return [
    ...left.map((col) => ({ row, col, hand: "left" as const, finger: SIX_COLUMNS[col] })),
    ...right.map((col) => ({ row, col, hand: "right" as const, finger: SIX_COLUMNS[cols - 1 - col] })),
  ];
}

/** A split board's finger block: six columns per hand, `left` and `right` the
 *  matrix columns of each hand from outer to inner. */
function spots(row: number, left: readonly number[], right: readonly number[]): KeySpot[] {
  return [
    ...left.map((col, i) => ({ row, col, hand: "left" as const, finger: SIX_COLUMNS[i] })),
    ...[...right].reverse().map((col, i) => ({ row, col, hand: "right" as const, finger: SIX_COLUMNS[SIX_COLUMNS.length - 1 - i] })),
  ];
}

/** Groups for a MoErgo-style split board: six finger columns per hand and
 *  thumb clusters in the middle columns. */
function splitBoard(layout: {
  left: readonly number[];
  right: readonly number[];
  functionRow: number | null;
  numberRow: number;
  letterRows: readonly [number, number, number];
  thumbs: readonly { row: number; col: number; hand: Hand }[];
}): Omit<KeyGroups, "bottom"> {
  const [, home] = layout.letterRows;
  const homeKeys = spots(home, layout.left, layout.right);
  return {
    letters: layout.letterRows.flatMap((row) => spots(row, layout.left, layout.right)),
    // Pinky to index on each hand: the outer pinky column and the inner index column take none.
    home_row: [...homeKeys.slice(1, 5), ...homeKeys.slice(7, 11)],
    thumbs: layout.thumbs.map((thumb) => ({ ...thumb, finger: "thumb" as const })),
    numbers: spots(layout.numberRow, layout.left, layout.right),
    function: layout.functionRow === null ? [] : spots(layout.functionRow, layout.left, layout.right),
  };
}

const LEFT = [0, 1, 2, 3, 4, 5];
const RIGHT = [13, 12, 11, 10, 9, 8];

/** Glove80: the function row is row 0 (five keys a hand), the thumb clusters
 *  are columns 6 and 7 of rows 0 to 5, three a hand on top, three below. */
export const GLOVE80_KEY_GROUPS: KeyGroups = {
  ...splitBoard({
    left: LEFT,
    right: RIGHT,
    functionRow: null,
    numberRow: 1,
    letterRows: [2, 3, 4],
    thumbs: [
      ...[0, 1, 2, 3, 4, 5].map((row) => ({ row, col: 6, hand: "left" as const })),
      ...[0, 1, 2, 3, 4, 5].map((row) => ({ row, col: 7, hand: "right" as const })),
    ],
  }),
  // Five function keys a hand: columns 0-4 on the left, 9-13 on the right.
  function: rowOf(0, [0, 1, 2, 3, 4], [9, 10, 11, 12, 13], 14),
  // Row 5, below the letters: five keys a hand, like the function row.
  bottom: rowOf(5, [0, 1, 2, 3, 4], [9, 10, 11, 12, 13], 14),
};

/** Go60: no function row; the thumb fans are columns 6 and 7 of rows 0 to 2,
 *  and row 4 has three keys a hand below the ring, middle and index fingers. */
export const GO60_KEY_GROUPS: KeyGroups = {
  ...splitBoard({
    left: LEFT,
    right: RIGHT,
    functionRow: null,
    numberRow: 0,
    letterRows: [1, 2, 3],
    thumbs: [
      ...[0, 1, 2].map((row) => ({ row, col: 6, hand: "left" as const })),
      ...[0, 1, 2].map((row) => ({ row, col: 7, hand: "right" as const })),
    ],
  }),
  bottom: rowOf(4, [2, 3, 4], [9, 10, 11], 14),
};
