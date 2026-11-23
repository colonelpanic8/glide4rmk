// A keyboard's add-ons (ADR 0028), as GLIDE has them (docs/specs/keyboards.md
// in glide-src): the places a board has for one, each with what kind it is and
// either the one built in or the module a layout turns on. A layout keeps the
// modules it turns on as MoErgo names them (`lh-cirque`, `rh-cirque`; a family
// name, `cirque`, turns on every module of it). Screens and Flows ask here,
// never by keyboard name. Pure.

export type AddOnKind = "pointing";

export interface AddOnPlace {
  id: string;
  label: string;
  kind: AddOnKind;
  side: "left" | "right";
  /** What it is called: "touchpad". */
  noun: string;
  /** Built into every board of this kind. */
  builtIn?: true;
  /** Else the module a layout turns on for it. */
  module?: string;
}

/** The Glove80's touchpad modules: MoErgo's Cirque, turned on per side. */
export const GLOVE80_ADD_ONS: readonly AddOnPlace[] = [
  { id: "left-touchpad", label: "Left touchpad", kind: "pointing", side: "left", noun: "touchpad", module: "lh-cirque" },
  { id: "right-touchpad", label: "Right touchpad", kind: "pointing", side: "right", noun: "touchpad", module: "rh-cirque" },
];

/** The Go60's touchpads are built in. */
export const GO60_ADD_ONS: readonly AddOnPlace[] = [
  { id: "left-touchpad", label: "Left touchpad", kind: "pointing", side: "left", noun: "touchpad", builtIn: true },
  { id: "right-touchpad", label: "Right touchpad", kind: "pointing", side: "right", noun: "touchpad", builtIn: true },
];

/** A module's family: `lh-cirque` → `cirque`. */
const familyOf = (module: string) => module.replace(/^[lr]h-/, "");

/** Whether a layout's modules fit this place: built in, its module on, or its family on. */
export function isFitted(place: AddOnPlace, modules: readonly string[]): boolean {
  if (place.builtIn) return true;
  return place.module !== undefined && (modules.includes(place.module) || modules.includes(familyOf(place.module)));
}

/** The places fitted on a board with these modules on. */
export function fittedAddOns(places: readonly AddOnPlace[], modules: readonly string[]): AddOnPlace[] {
  return places.filter((place) => isFitted(place, modules));
}

/** The kinds of add-on fitted: what a Flow reads as the board's extras. */
export function addOnKinds(places: readonly AddOnPlace[], modules: readonly string[]): AddOnKind[] {
  return [...new Set(fittedAddOns(places, modules).map(({ kind }) => kind))];
}

/** The modules with one place's module turned on or off, in the board's order
 *  (modules it does not know last, kept). A family name that covered it is
 *  spelled out per side, so the other side keeps its state. */
export function withPlace(places: readonly AddOnPlace[], modules: readonly string[], place: AddOnPlace, on: boolean): string[] {
  if (!place.module) return [...modules];
  const family = familyOf(place.module);
  const covered = modules.includes(family)
    ? places.flatMap((other) => (other.module && familyOf(other.module) === family ? [other.module] : []))
    : [];
  const rest = [...modules.filter((module) => module !== family), ...covered].filter((module) => module !== place.module);
  const next = on ? [...rest, place.module] : rest;
  // In the board's order, each once.
  const order = places.flatMap((other) => (other.module ? [other.module] : []));
  const rank = (module: string) => (order.includes(module) ? order.indexOf(module) : order.length);
  return [...new Set(next)].sort((a, b) => rank(a) - rank(b));
}

/** MoErgo's `hardware_modules`: "lh-cirque,rh-cirque" → ["lh-cirque", "rh-cirque"]. */
export function readModules(text: unknown): string[] {
  return typeof text === "string" ? text.split(",").map((module) => module.trim()).filter(Boolean) : [];
}

export const writeModules = (modules: readonly string[]): string => modules.join(",");
