/**
 * The eight colours a player can pick for their dot.
 *
 * A curated list rather than a free `<input type="color">`, because a dot has to
 * stay legible on two different grounds: someone would otherwise pick #101316
 * and vanish in dark mode. Every entry here is defined twice in globals.css —
 * once for light, once for dark — and each pair clears 4.5:1 against its own
 * background. The names are the contract between the database, the CSS
 * `[data-color]` rules and the swatch UI, so they are lower-case and stable.
 */
export const PLAYER_COLORS = [
  { name: "clay", label: "Clay" },
  { name: "moss", label: "Moss" },
  { name: "plum", label: "Plum" },
  { name: "sky", label: "Sky" },
  { name: "ochre", label: "Ochre" },
  { name: "teal", label: "Teal" },
  { name: "rose", label: "Rose" },
  { name: "slate", label: "Slate" },
] as const;

export type PlayerColor = (typeof PLAYER_COLORS)[number]["name"];

const NAMES: readonly string[] = PLAYER_COLORS.map((c) => c.name);

export function isPlayerColor(value: unknown): value is PlayerColor {
  return typeof value === "string" && NAMES.includes(value);
}

/**
 * The colour to actually draw a dot in.
 *
 * `color` is null for everyone who plotted before the picker existed, and for
 * anyone who has not chosen. Falling back to a hash of their initials rather
 * than to one default means an old board still comes out varied instead of
 * turning into a single wall of blue — and it is stable, so the same person
 * keeps the same colour every time you look.
 */
export function colorFor(color: string | null | undefined, initials: string): PlayerColor {
  if (isPlayerColor(color)) return color;
  let hash = 0;
  for (let i = 0; i < initials.length; i += 1) hash = (hash * 31 + initials.charCodeAt(i)) >>> 0;
  return PLAYER_COLORS[hash % PLAYER_COLORS.length].name;
}
