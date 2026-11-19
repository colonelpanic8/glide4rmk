// The real jq for tests: jq-web's wasm build, the one the browser's worker
// runs (its asm.js build fails on longer scripts), here on Node without the
// time limit. Emscripten fetches the .wasm when fetch exists, which Node's
// cannot do for a file path, so fetch is hidden while it loads from disk.

import { createRequire } from "node:module";
import type { Jq } from "jq-web";
import { readableJqError, type JqRunner } from "../operations/flows";

const fetch = globalThis.fetch;
Reflect.deleteProperty(globalThis, "fetch");
const jq = createRequire(import.meta.url)("jq-web/jq.wasm.js") as Jq;
await new Promise<void>((ready) => jq.onInitialized.addListener(ready));
globalThis.fetch = fetch;

export const nodeJq: JqRunner = {
  async run(input, program, { lineOffset }) {
    try {
      return { ok: true, output: await jq.promised.json(input, program) };
    } catch (error) {
      const { message, stack } = error as Error;
      return { ok: false, message: readableJqError(message, String(stack ?? ""), lineOffset) };
    }
  },
};
