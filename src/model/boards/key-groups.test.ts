import { describe, expect, it } from "vitest";
import { GLOVE80_KEY_GROUPS, GO60_KEY_GROUPS, KEY_GROUP_NAMES, type KeyGroups } from "./key-groups";
import { GLOVE80_MATRIX_POSITIONS } from "./glove80";
import { GO60_KEYS } from "./go60";

const at = ({ row, col }: { row: number; col: number }) => `${row}:${col}`;

describe.each([
  ["Glove80", GLOVE80_KEY_GROUPS, new Set(GLOVE80_MATRIX_POSITIONS.map(at)), 3],
  ["Go60", GO60_KEY_GROUPS, new Set(GO60_KEYS.map(at)), 2],
] as [string, KeyGroups, Set<string>, number][])("the %s's key groups", (_name, groups, keys, homeRow) => {
  it("name only keys the board has, each once", () => {
    for (const name of KEY_GROUP_NAMES) {
      const places = groups[name].map(at);
      expect(places.filter((place) => !keys.has(place)), name).toEqual([]);
      expect(new Set(places).size, name).toBe(places.length);
    }
  });

  it("have 36 letter keys, three rows of six a hand, in reading order", () => {
    expect(groups.letters).toHaveLength(36);
    expect(groups.letters.slice(0, 12).map(({ hand }) => hand)).toEqual([...Array(6).fill("left"), ...Array(6).fill("right")]);
    expect(groups.letters.slice(0, 12).map(({ col }) => col)).toEqual([0, 1, 2, 3, 4, 5, 8, 9, 10, 11, 12, 13]);
  });

  it("put the home-row mods on the home row, pinky to pinky", () => {
    expect(groups.home_row.map(({ row }) => row)).toEqual(Array(8).fill(homeRow));
    expect(groups.home_row.map(({ col }) => col)).toEqual([1, 2, 3, 4, 9, 10, 11, 12]);
    expect(groups.home_row.map(({ finger }) => finger)).toEqual(["pinky", "ring", "middle", "index", "index", "middle", "ring", "pinky"]);
  });

  it("name every key once between them (the home row is part of the letters)", () => {
    const places = KEY_GROUP_NAMES.filter((name) => name !== "home_row").flatMap((name) => groups[name].map(at));
    expect(new Set(places).size).toBe(places.length);
    expect(new Set(places)).toEqual(keys);
  });

  it("have thumbs on both hands", () => {
    expect(new Set(groups.thumbs.map(({ hand }) => hand))).toEqual(new Set(["left", "right"]));
    expect(groups.thumbs.every(({ finger }) => finger === "thumb")).toBe(true);
  });
});
