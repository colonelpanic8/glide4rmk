// The Flows that ship with GLIDE4RMK (ADR 0025): every file under flows/,
// loaded when first asked for, so with Flows off none of them is fetched.

import { readFlowFiles, type Flow } from "../operations/flows";

const FILES = import.meta.glob<string>("../../flows/*/*.flows", { query: "?raw", import: "default" });
const PREFIX = "../../flows/";

let loaded: Promise<{ flows: Flow[]; problems: string[] }> | null = null;

/** Every shipped Flow, and a sentence for each file that cannot be used. */
export function shippedFlows(): Promise<{ flows: Flow[]; problems: string[] }> {
  loaded ??= Promise.all(Object.entries(FILES).map(async ([path, load]) => [path.slice(PREFIX.length), await load()] as const)).then(
    (files) => readFlowFiles(Object.fromEntries(files)),
  );
  return loaded;
}
