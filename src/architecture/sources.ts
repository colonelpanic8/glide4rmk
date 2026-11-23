// File text for the ratchet guards' tests: they check text, not modules, so
// a rule can be tested on a string and run on the tree the same way.

import { readdirSync, readFileSync, statSync } from "node:fs";

const ROOT = new URL("../../", import.meta.url);

/** One file's text, by its path from the repository root. */
export function readSource(path: string): string {
  return readFileSync(new URL(path, ROOT), "utf8");
}

/** Every .ts and .tsx file under `dir` (path from the repository root to text). */
export function readSourcesUnder(dir: string): Record<string, string> {
  const files: Record<string, string> = {};
  for (const name of readdirSync(new URL(`${dir}/`, ROOT))) {
    const path = `${dir}/${name}`;
    if (statSync(new URL(path, ROOT)).isDirectory()) Object.assign(files, readSourcesUnder(path));
    else if (/\.(ts|tsx)$/.test(name)) files[path] = readSource(path);
  }
  return files;
}
