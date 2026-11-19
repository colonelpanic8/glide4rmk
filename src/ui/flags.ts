// Features still being built, off until turned on in this browser: open the
// app with `?flags=flows` (several: `?flags=flows,webmcp`; none: `?flags=`).
// The choice is kept, so the address need not carry it again.

import { createSetting, SETTING_KEYS } from "./settings";

export const FLAGS = ["flows", "webmcp"] as const;
export type FlagId = (typeof FLAGS)[number];

/** The flags named in a list, known ones only. */
export function parseFlags(raw: string | null): readonly FlagId[] {
  const named = (raw ?? "").split(",").map((part) => part.trim());
  return FLAGS.filter((flag) => named.includes(flag));
}

const flags = createSetting<readonly FlagId[]>(SETTING_KEYS.flags, parseFlags, (value) => value.join(","));

export const flagOn = (flag: FlagId): boolean => flags.get().includes(flag);

/** Takes `?flags=…` from the page's address, if it has one. */
export function flagsFromAddress(search: string): void {
  const value = new URLSearchParams(search).get("flags");
  if (value !== null) flags.set(parseFlags(value));
}
