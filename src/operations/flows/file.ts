// A `.flows` file (ADR 0025): GLIDE's TOML, read and checked. A file that is
// not a GLIDE4RMK Flow, or that breaks a rule, is refused with a sentence
// naming the file, so a broken Flow never reaches the list. Pure.

import { parse } from "smol-toml";
import { checkChoices, type ChoiceType, type ChoiceValue, type FlowChoice } from "./choices";
import { BOARD_PROFILES } from "../../model/boards/profiles";
import { KEY_GROUP_NAMES, type KeyGroupName } from "../../model/boards/key-groups";
import type { Board } from "../describe";

export const RUNS_ON = "glide4rmk";
const UID = /^[a-z][a-z0-9_]{1,63}$/;
const JQ_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;
const CHOICE_TYPES: readonly ChoiceType[] = ["select", "boolean", "number", "text"];
/** The folders a Flow may sit in: `shared/` for every keyboard, and one per
 *  board the registry knows, named by its id, for that board only. */
export const FLOW_FOLDERS: readonly string[] = ["shared", ...BOARD_PROFILES.map(({ id }) => id)];

export interface Flow {
  uid: string;
  title: string;
  subtitle: string;
  /** Markdown; its first sentence is the Flow's line in a list. */
  description: string;
  category: string;
  script: string;
  choices: FlowChoice[];
  author: string;
  icon: string;
  keywords: string[];
  advanced: boolean;
  /** Board ids it is for; null for every keyboard. */
  keyboards: string[] | null;
  /** Capability ids the keyboard needs (`behaviors.morse`, …). */
  requires: string[];
  /** Key groups the board needs (`home_row`, `letters`, …; ADR 0027). */
  needsKeys: KeyGroupName[];
  /** The fewest keys the board may have; 0 for any. */
  minKeys: number;
  /** Where it came from, for messages and the run log: `shared/autoshift.flows`. */
  file: string;
}

export type FlowRead = { ok: true; flow: Flow } | { ok: false; message: string };

type Table = Record<string, unknown>;
const isTable = (value: unknown): value is Table => typeof value === "object" && value !== null && !Array.isArray(value);
const text = (value: unknown): string => (typeof value === "string" ? value : "");
const strings = (value: unknown): string[] | null =>
  Array.isArray(value) && value.every((item) => typeof item === "string") ? value : null;

function readChoice(raw: unknown, index: number): FlowChoice | string {
  if (!isTable(raw)) return `choice ${index + 1} is not a table`;
  const { id, label, type, options, labels } = raw;
  if (typeof id !== "string" || !JQ_NAME.test(id)) return `choice ${index + 1} needs an id that is a jq name`;
  if (!CHOICE_TYPES.includes(type as ChoiceType)) return `the choice "${id}" needs a type: ${CHOICE_TYPES.join(", ")}`;
  if (type === "select" && !strings(options)?.length) return `the choice "${id}" needs its options`;
  if (labels !== undefined && strings(labels)?.length !== strings(options)?.length) return `the choice "${id}" needs one label per option`;
  if (!["string", "number", "boolean"].includes(typeof raw.default)) return `the choice "${id}" needs a default`;
  const choice: FlowChoice = { id, label: text(label) || id, type: type as ChoiceType, default: raw.default as ChoiceValue };
  if (type === "select") choice.options = strings(options) ?? [];
  if (labels !== undefined) choice.labels = strings(labels) ?? [];
  const wrong = checkChoices([choice], { [id]: choice.default });
  return wrong ? `the default of "${id}" is not valid: ${wrong}` : choice;
}

function readFlow(raw: Table, file: string): Flow | string {
  if (raw.runs_on !== RUNS_ON) return `it is not a GLIDE4RMK Flow (runs_on = "${RUNS_ON}" is missing)`;
  const uid = text(raw.uid);
  if (!UID.test(uid)) return "its uid has to be a lowercase letter, then lowercase letters, digits and _ (2 to 64)";
  if (!text(raw.title).trim()) return "it has no title";
  if (!text(raw.script).trim()) return "its script is empty";
  const manifest = isTable(raw.manifest) ? raw.manifest : {};
  const keyboards = manifest.keyboards === undefined ? null : strings(manifest.keyboards);
  if (manifest.keyboards !== undefined && !keyboards?.length) return "its keyboards have to be a list of board ids";
  const folder = file.split("/")[0];
  if (!FLOW_FOLDERS.includes(folder)) return `it has to sit in ${FLOW_FOLDERS.join("/, ")}/`;
  if (folder !== "shared" && keyboards && !keyboards.includes(folder)) return `it sits in ${folder}/ but its keyboards do not list ${folder}`;
  const requires = manifest.requires === undefined ? [] : strings(manifest.requires);
  if (!requires) return "its requires have to be a list of capability ids";
  const needsKeys = manifest.needs_keys === undefined ? [] : strings(manifest.needs_keys);
  const unknown = needsKeys?.find((name) => !(KEY_GROUP_NAMES as readonly string[]).includes(name));
  if (!needsKeys || unknown !== undefined) return `its needs_keys have to be key groups: ${KEY_GROUP_NAMES.join(", ")}`;
  const minKeys = manifest.min_keys ?? 0;
  if (!Number.isInteger(minKeys) || (minKeys as number) < 0) return "its min_keys has to be a whole number";
  const params = raw.param === undefined ? [] : raw.param;
  if (!Array.isArray(params)) return "its choices have to be [[param]] tables";
  const choices: FlowChoice[] = [];
  for (const [index, param] of params.entries()) {
    const choice = readChoice(param, index);
    if (typeof choice === "string") return choice;
    if (choices.some(({ id }) => id === choice.id)) return `the choice "${choice.id}" is there twice`;
    choices.push(choice);
  }
  return {
    uid,
    title: text(raw.title).trim(),
    subtitle: text(raw.subtitle),
    description: text(raw.description).trim(),
    category: text(raw.category) || "Utilities",
    script: text(raw.script).replace(/\r\n/g, "\n"),
    choices,
    author: text(manifest.author),
    icon: text(manifest.icon),
    keywords: strings(manifest.keywords) ?? [],
    advanced: manifest.advanced === true,
    // A board's own folder makes it that board's Flow.
    keyboards: keyboards ?? (folder === "shared" ? null : [folder]),
    requires,
    needsKeys: needsKeys as KeyGroupName[],
    minKeys: minKeys as number,
    file,
  };
}

/** Reads one `.flows` file; `file` is its path under the flows folder. */
export function readFlowFile(source: string, file: string): FlowRead {
  let raw: unknown;
  try {
    raw = parse(source);
  } catch (error) {
    return { ok: false, message: `${file} is not valid TOML: ${error instanceof Error ? error.message.split("\n")[0] : String(error)}` };
  }
  const flow = readFlow(raw as Table, file);
  return typeof flow === "string" ? { ok: false, message: `${file} cannot be used: ${flow}.` } : { ok: true, flow };
}

/** Every Flow of a set of files; a broken file, or a uid used twice, is left out and named in `problems`. */
export function readFlowFiles(files: Readonly<Record<string, string>>): { flows: Flow[]; problems: string[] } {
  const flows: Flow[] = [];
  const problems: string[] = [];
  for (const [file, source] of Object.entries(files).sort(([a], [b]) => a.localeCompare(b))) {
    const read = readFlowFile(source, file);
    if (!read.ok) problems.push(read.message);
    else if (flows.some(({ uid }) => uid === read.flow.uid)) problems.push(`${file} cannot be used: its uid ${read.flow.uid} is taken.`);
    else flows.push(read.flow);
  }
  return { flows, problems };
}

/** Whether a Flow is for another keyboard only: it is not listed at all. */
export function flowIsElsewhere(flow: Flow, keyboard: string | null): boolean {
  return flow.keyboards !== null && !(keyboard && flow.keyboards.includes(keyboard));
}

/** Why a Flow cannot run on this keyboard, or null when it can: its
 *  keyboards (if it names any) include this one, the board has the key
 *  groups and the keys it needs, and every capability it requires. */
export function flowNotFor(flow: Flow, board: Board, has: (capability: string) => boolean): string | null {
  if (flowIsElsewhere(flow, board.id)) return `For the ${flow.keyboards!.join(" and ")} only.`;
  const groups = flow.needsKeys.filter((name) => !board.groups?.[name]?.length);
  if (groups.length) return `Needs a keyboard that GLIDE4RMK knows the ${groups.map((name) => name.replace("_", " ")).join(" and ")} of.`;
  if (board.keyCount !== undefined && board.keyCount < flow.minKeys) return `Needs a keyboard with at least ${flow.minKeys} keys.`;
  const missing = flow.requires.filter((capability) => !has(capability));
  return missing.length ? `Needs what this keyboard does not have: ${missing.join(", ")}.` : null;
}
