import { parseLabel } from "./validate";

/**
 * A share is self-contained: four axis labels and a 0–1 plot. The live board
 * uses −1…1 (see Plane.tsx); the URL uses the same axes remapped to 0…1 so a
 * crawler can draw the card without a player row, and so next week's labels
 * cannot rewrite last week's link.
 */
export type ShareAxes = {
  xl: string;
  xr: string;
  yt: string;
  yb: string;
};

export type SharePlot = {
  x: number;
  y: number;
};

export type ShareCard = ShareAxes & SharePlot;

/** −1…1 (Plane) → 0…1 (share URL). y still grows upward. */
export function toSharePlot(x: number, y: number): SharePlot {
  return { x: (x + 1) / 2, y: (y + 1) / 2 };
}

function formatCoord(n: number): string {
  // Short, stable, and enough to put the halo back on the same pixel.
  return String(Math.round(n * 1000) / 1000);
}

export function shareSearch(card: ShareCard): string {
  const q = new URLSearchParams({
    xl: card.xl,
    xr: card.xr,
    yt: card.yt,
    yb: card.yb,
    x: formatCoord(card.x),
    y: formatCoord(card.y),
  });
  return q.toString();
}

export function sharePath(card: ShareCard): string {
  return `/s?${shareSearch(card)}`;
}

function one(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseUnit(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(1, Math.max(0, n));
}

/**
 * Read a share card from query params. Missing or junk fields yield null —
 * the page is still the live board; the card just has nothing of its own to say.
 */
export function parseShareCard(
  input: URLSearchParams | Record<string, string | string[] | undefined>,
): ShareCard | null {
  const get = (key: string) =>
    input instanceof URLSearchParams ? (input.get(key) ?? undefined) : one(input[key]);

  const xl = parseLabel(get("xl"));
  const xr = parseLabel(get("xr"));
  const yt = parseLabel(get("yt"));
  const yb = parseLabel(get("yb"));
  const x = parseUnit(get("x"));
  const y = parseUnit(get("y"));
  if (!xl || !xr || !yt || !yb || x === null || y === null) return null;
  return { xl, xr, yt, yb, x, y };
}

/** Nearer end of a −1…1 axis. A tie (dead centre) still picks an end. */
function nearer(plane: number, low: string, high: string): string {
  return plane <= 0 ? low : high;
}

function onTheLine(plane: number): boolean {
  // Same cut Plane uses for "centre" in the readout.
  return Math.round(Math.abs(plane) * 100) < 5;
}

/**
 * The only line that goes in a share. No article, no "I'm an", no dare.
 * Both axes near the midpoint: the centre line. One axis on the line: still
 * both nearer labels — there is no third template.
 */
export function imLine(card: ShareCard): string {
  const px = card.x * 2 - 1;
  const py = card.y * 2 - 1;
  if (onTheLine(px) && onTheLine(py)) return "I'm on the line this week.";
  return `I'm ${nearer(px, card.xl, card.xr)}, ${nearer(py, card.yb, card.yt)}.`;
}

export const SIT_DARE = "Where would you sit?";
