import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { findBoardFactsInCode, findBoardFactsInFlows, isBoardFactsChecked } from "./board-facts";
import { readSourcesUnder } from "./sources";

describe("the board facts rule itself", () => {
  it("holds production code to it, and leaves the registry, the simulated boards and tests alone", () => {
    expect(isBoardFactsChecked("src/config/migration.ts")).toBe(true);
    expect(isBoardFactsChecked("src/ui/lighting/StatusSetupsInFlows.tsx")).toBe(true);
    expect(isBoardFactsChecked("src/model/boards/profiles/moergo.ts")).toBe(false);
    expect(isBoardFactsChecked("src/session/offline/go60.ts")).toBe(false);
    expect(isBoardFactsChecked("src/config/migration.test.ts")).toBe(false);
  });

  it("finds a board id as a value or a key, a board's table or file, and leaves prose alone", () => {
    const found = findBoardFactsInCode({
      "src/config/a.ts": [
        'if (board.id === "glove80") {}',
        "const layers = { glove80: 2, go60: 3 };",
        'import { GO60_KEYS } from "../model/boards/go60";',
        "// The Glove80's thumbs, as a comment: fine.",
        'throw new Error("only Glove80 and Go60 layouts open here");',
        "const name = profile.name; // a go60 in a comment",
      ].join("\n"),
    });
    expect(found.map(({ what, text }) => `${what}: ${text}`)).toEqual([
      'a board id as a value: "glove80"',
      "a board id as a key: glove80:",
      "a board id as a key: go60:",
      "a board's own table: GO60_KEYS",
      "a board's own file: model/boards/go60",
    ]);
  });

  it("finds a board id in a shared Flow's script, not in its comments, words or manifest", () => {
    const flow = (script: string) => `title = "T"\nscript = '''\n${script}\n'''\n[manifest]\nkeyboards = ["glove80", "go60"]\n`;
    expect(findBoardFactsInFlows({ "flows/shared/a.flows": flow('({glove80: 2, go60: 3}[$view.board.id]) as $own |\n# the glove80 layer\nerror("Only the Glove80")') }).map(({ text }) => text)).toEqual([
      "glove80",
      "go60",
    ]);
    expect(findBoardFactsInFlows({ "flows/glove80/a.flows": flow('"glove80"') })).toEqual([]);
  });
});

describe("board facts in the tree (ADR 0037)", () => {
  it("live in the registry: no code outside it names a board, keeps a table for one or branches on one", () => {
    expect(findBoardFactsInCode(readSourcesUnder("src"))).toEqual([]);
  });

  it("reach shared Flows through their description, never a table by board id", () => {
    const dir = new URL("../../flows/shared/", import.meta.url);
    const files = Object.fromEntries(
      readdirSync(dir).filter((name) => name.endsWith(".flows")).map((name) => [`flows/shared/${name}`, readFileSync(new URL(name, dir), "utf8")]),
    );
    expect(Object.keys(files).length).toBeGreaterThan(0);
    expect(findBoardFactsInFlows(files)).toEqual([]);
  });
});
