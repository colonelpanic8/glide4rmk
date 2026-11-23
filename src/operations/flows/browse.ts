// Browsing the Flows (ADR 0025), as GLIDE's Flows window does: categories as
// tiles in a fixed order, a category's Flows (advanced ones last, then by
// title), search in a person's own words, and a description's first sentence
// as its tagline. Pure.

import type { Flow } from "./file";

/** The categories in the order their tiles show, each with its icon; GLIDE's. */
export const CATEGORY_ICONS: Readonly<Record<string, string>> = {
  "Modifier keys": "⌨️",
  Symbols: "🔣",
  "QWERTY alternatives": "🔠",
  "Shortcuts & macros": "⚡",
  Mouse: "🖱️",
  Gaming: "🎮",
  "Looks & lighting": "💡",
  Other: "🛠️",
};
export const OTHER_CATEGORY_ICON = "⚙️";

const rank = (category: string): number => {
  const index = Object.keys(CATEGORY_ICONS).indexOf(category);
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
};

export interface CategoryTile {
  category: string;
  icon: string;
  /** The first few Flows' icons: a preview of what is inside. */
  preview: string[];
  count: number;
}

const byRank = (a: Flow, b: Flow): number => Number(a.advanced) - Number(b.advanced) || a.title.localeCompare(b.title);

/** One tile per category that has a Flow, in GLIDE's order (others after, by name). */
export function categoryTiles(flows: readonly Flow[]): CategoryTile[] {
  const categories = [...new Set(flows.map(({ category }) => category))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
  return categories.map((category) => {
    const inside = flowsIn(flows, category);
    return { category, icon: CATEGORY_ICONS[category] ?? OTHER_CATEGORY_ICON, preview: inside.slice(0, 3).map(({ icon }) => icon), count: inside.length };
  });
}

/** A category's Flows: advanced ones last, otherwise by title. */
export function flowsIn(flows: readonly Flow[], category: string): Flow[] {
  return flows.filter((flow) => flow.category === category).sort(byRank);
}

const normal = (text: string): string => text.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();

/** The Flows whose title, subtitle, category, description, keywords or file has the words searched for. */
export function searchFlows(flows: readonly Flow[], query: string): Flow[] {
  const wanted = normal(query);
  if (!wanted) return [];
  return flows
    .filter((flow) => [flow.title, flow.subtitle, flow.category, flow.description, flow.keywords.join(" "), flow.file].some((text) => normal(text).includes(wanted)))
    .sort(byRank);
}

/** A description as its first sentence (the line at the top of a Flow's page) and the rest (under "More details"). */
export function splitDescription(description: string): { tagline: string; more: string } {
  const text = description.trim();
  const end = text.search(/(?<!\be\.g|\bi\.e|\betc)[.!?](\s|$)/);
  if (end < 0) return { tagline: text, more: "" };
  return { tagline: text.slice(0, end + 1).trim(), more: text.slice(end + 1).trim() };
}
