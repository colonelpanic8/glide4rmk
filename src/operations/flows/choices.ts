// A Flow's choices (ADR 0025), as GLIDE and Flows4JSON have them: checked
// before anything runs, then put before the script as `<value> as $<id> |`, one
// line each, so one file binds the same way everywhere. Pure.

export type ChoiceType = "select" | "boolean" | "number" | "text";
export type ChoiceValue = string | number | boolean;

export interface FlowChoice {
  /** The jq variable: `mode` is `$mode` in the script. */
  id: string;
  /** The question as the person sees it; messages name the choice by it. */
  label: string;
  type: ChoiceType;
  /** `select` only: the values the script gets. */
  options?: string[];
  /** `select` only: what the person sees for each option, same order. */
  labels?: string[];
  default: ChoiceValue;
}

/** What is wrong with the values given, or null. A missing value means the default. */
export function checkChoices(choices: readonly FlowChoice[], values: Readonly<Record<string, unknown>>): string | null {
  for (const choice of choices) {
    if (!Object.hasOwn(values, choice.id)) continue;
    const value = values[choice.id];
    const name = `"${choice.label || choice.id}"`;
    if (choice.type === "select" && !(choice.options ?? []).includes(String(value))) {
      return `The choice ${name} has to be one of: ${(choice.options ?? []).join(", ")}. Nothing was changed.`;
    }
    if (choice.type === "boolean" && typeof value !== "boolean") return `The choice ${name} has to be on or off. Nothing was changed.`;
    if (choice.type === "number" && String(value ?? "").trim() !== "" && !Number.isFinite(Number(value))) {
      return `The choice ${name} has to be a number. Nothing was changed.`;
    }
  }
  return null;
}

/** One value as a jq literal: a bare boolean or number (a negative one in
 *  parentheses, or jq reads `-1 as $x | …` as `-(1 as $x | …)`), else a string. */
export function choiceLiteral(choice: FlowChoice, value: unknown): string {
  if (choice.type === "boolean") return value ? "true" : "false";
  if (choice.type === "number") {
    const text = String(value ?? "").trim() !== "" && Number.isFinite(Number(value)) ? String(value).trim() : String(choice.default);
    return text.startsWith("-") ? `(${text})` : text;
  }
  return JSON.stringify(String(value ?? ""));
}

/** The script with its choices bound before it; `lineOffset` is how many lines came first. */
export function bindChoices(
  choices: readonly FlowChoice[],
  values: Readonly<Record<string, unknown>>,
  script: string,
): { program: string; lineOffset: number } {
  const lines = choices.map((choice) => `${choiceLiteral(choice, Object.hasOwn(values, choice.id) ? values[choice.id] : choice.default)} as $${choice.id} | \n`);
  return { program: lines.join("") + script, lineOffset: choices.length };
}
