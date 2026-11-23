// GLIDE writes key colours and labels into a MoErgo JSON layout as each
// binding's `decoration` (`{ background, label, … }`). GLIDE4RMK does not keep
// them yet (todo 28), and the converter drops them without a word, so the
// import says so. Pure.

import type { ImportNote } from "./document";

/** One note for the keys whose GLIDE decoration an import of `text` drops; none when there are none. */
export function decorationNotes(text: string): ImportNote[] {
  let layout: unknown;
  try {
    layout = JSON.parse(text);
  } catch {
    return []; // not JSON: TOML has no decorations
  }
  const layers = (layout as { layers?: unknown } | null)?.layers;
  if (!Array.isArray(layers)) return [];
  const decorated = layers.flatMap((layer: unknown) =>
    Array.isArray(layer) ? layer.filter((binding: unknown) => typeof binding === "object" && binding !== null && "decoration" in binding) : [],
  ).length;
  if (decorated === 0) return [];
  return [
    {
      approximated: true,
      location: undefined,
      message: `${decorated} key${decorated === 1 ? "" : "s"} lose${decorated === 1 ? "s" : ""} the colour or label GLIDE gave ${decorated === 1 ? "it" : "them"}: GLIDE4RMK does not keep them yet.`,
    },
  ];
}
