// Modifiers read the way the chosen computer writes them: ⌘ on a Mac, Ctrl and
// Windows elsewhere. One file knows how (ui/keyface/modifiers.ts); text and key
// faces ask it. A Mac symbol written straight into a screen or a label is how
// the key editor came to show ⌘ on Windows, so code never spells one out.
// Comments may: they explain, they are never shown.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../../", import.meta.url);
const SYMBOLS = /[⌃⌥⇧⌘⊞❖]/;

/** Files that may spell a modifier symbol, and why. */
const ALLOWED: Record<string, string> = {
  "src/ui/keyface/modifiers.ts": "the one place that knows how each computer writes a modifier",
  "src/model/boards/glove80.ts": "the legends printed on the Glove80's own keycaps",
};

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(new URL(`${dir}/`, ROOT))) {
    const path = `${dir}/${name}`;
    if (statSync(new URL(path, ROOT)).isDirectory()) out.push(...sources(path));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path);
  }
  return out;
}

/** The code without its comments (line and block), good enough for this check. */
const withoutComments = (code: string) => code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

describe("modifier text", () => {
  it("comes from keyface/modifiers.ts, never a symbol written into the code", () => {
    const found = [...sources("src/ui"), ...sources("src/model")].flatMap((path) => {
      if (ALLOWED[path]) return [];
      const code = withoutComments(readFileSync(new URL(path, ROOT), "utf8"));
      return code.split("\n").flatMap((line, i) => (SYMBOLS.test(line) ? [`${path}:${i + 1}: ${line.trim()}`] : []));
    });
    expect(found).toEqual([]);
  });

  it("lists only files that still need it", () => {
    for (const path of Object.keys(ALLOWED)) {
      expect(SYMBOLS.test(readFileSync(new URL(path, ROOT), "utf8")), path).toBe(true);
    }
  });
});
