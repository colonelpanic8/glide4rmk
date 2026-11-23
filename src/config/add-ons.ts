// A layout file's add-on modules (ADR 0028). MoErgo JSON has a place for them,
// as GLIDE and MoErgo's editor write it: `layout_parameters.hardware_modules`,
// "lh-cirque,rh-cirque". The TOML format rejects unknown fields, so a TOML file
// keeps them as a comment line before its first table, as behavior
// descriptions are kept (ADR 0020); other tools ignore it. Pure text work on
// the renderer's output.

import type { ConfigFormat } from "./document";
import { readModules, writeModules } from "../model/boards/add-ons";

const TOML_LINE = /^# hardware_modules = "(.*)"\s*$/;

/** The modules a file turns on; an empty list when it says nothing. */
export function modulesFromFile(text: string, format: ConfigFormat): string[] {
  if (format === "toml") {
    for (const line of text.split("\n")) {
      if (line.trimStart().startsWith("[")) break;
      const found = line.match(TOML_LINE);
      if (found) return readModules(found[1]);
    }
    return [];
  }
  try {
    return readModules((JSON.parse(text) as { layout_parameters?: { hardware_modules?: unknown } })?.layout_parameters?.hardware_modules);
  } catch {
    return [];
  }
}

/** The file with these modules turned on (and no line or field when none). */
export function withModules(text: string, format: ConfigFormat, modules: readonly string[]): string {
  if (format === "toml") {
    const lines = text.split("\n");
    const first = lines.findIndex((line) => line.trimStart().startsWith("["));
    const head = (first < 0 ? lines : lines.slice(0, first)).filter((line) => !TOML_LINE.test(line));
    const rest = first < 0 ? [] : lines.slice(first);
    const line = modules.length ? [`# hardware_modules = "${writeModules(modules)}"`] : [];
    return [...line, ...head, ...rest].join("\n");
  }
  const json = JSON.parse(text) as { layout_parameters?: Record<string, unknown> };
  const { hardware_modules: _old, ...params } = json.layout_parameters ?? {};
  json.layout_parameters = modules.length ? { ...params, hardware_modules: writeModules(modules) } : params;
  const indent = text.match(/^\{\s*\n([ \t]+)/)?.[1] ?? (text.includes("\n") ? 2 : 0);
  return JSON.stringify(json, null, indent) + (text.endsWith("\n") ? "\n" : "");
}
