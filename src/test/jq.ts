// The real jq (jq-web) for tests: the engine the browser's worker runs, here
// on Node, without the time limit.

import jq from "jq-web";
import { readableJqError, type JqRunner } from "../operations/flows";

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
