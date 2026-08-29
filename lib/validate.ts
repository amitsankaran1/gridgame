import { isPlayerColor, type PlayerColor } from "./colors";

/** Clamp to the -1…1 plane. Rejects anything that isn't a finite number. */
export function parseCoord(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(1, Math.max(-1, value));
}

/** One of the eight palette names, or null. */
export function parseColor(value: unknown): PlayerColor | null {
  return isPlayerColor(value) ? value : null;
}

/** Exactly three characters, A–Z or 0–9, upper-cased. */
export function parseInitials(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim().toUpperCase();
  return /^[A-Z0-9]{3}$/.test(cleaned) ? cleaned : null;
}

const LABEL_MAX = 40;

/** An axis end label: non-empty, single line, capped so it can't blow the layout. */
export function parseLabel(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0 || cleaned.length > LABEL_MAX) return null;
  return cleaned;
}

const TITLE_MAX = 80;

export function parseTitle(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (cleaned.length === 0 || cleaned.length > TITLE_MAX) return null;
  return cleaned;
}

export type AxisLabels = {
  x_left: string;
  x_right: string;
  y_bottom: string;
  y_top: string;
};

/** All four axis ends, or null if any one of them is bad. */
export function parseAxes(body: Record<string, unknown>): AxisLabels | null {
  const x_left = parseLabel(body.x_left);
  const x_right = parseLabel(body.x_right);
  const y_bottom = parseLabel(body.y_bottom);
  const y_top = parseLabel(body.y_top);
  if (!x_left || !x_right || !y_bottom || !y_top) return null;
  return { x_left, x_right, y_bottom, y_top };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
