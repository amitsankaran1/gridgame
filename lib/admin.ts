import { createHmac, timingSafeEqual, createHash } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "gg_admin";
const SESSION_SECONDS = 60 * 60 * 12;

function secret(): string {
  const value = process.env.ADMIN_SESSION_SECRET;
  if (!value) throw new Error("ADMIN_SESSION_SECRET is not set");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

/** Constant-time compare of two strings of any length. */
function safeEqual(a: string, b: string): boolean {
  // Hash first so the buffers are always the same size — timingSafeEqual
  // throws on a length mismatch, which would itself leak the length.
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPassword(candidate: unknown): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD is not set");
  if (typeof candidate !== "string" || candidate.length === 0) return false;
  return safeEqual(candidate, expected);
}

/** Cookie value is `expiry.HMAC(expiry)` — stateless, no session table. */
export async function startAdminSession(): Promise<void> {
  const expiry = String(Math.floor(Date.now() / 1000) + SESSION_SECONDS);
  const jar = await cookies();
  jar.set(ADMIN_COOKIE, `${expiry}.${sign(expiry)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_SECONDS,
  });
}

export async function endAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(ADMIN_COOKIE)?.value;
  if (!raw) return false;
  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return false;
  const expiry = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);
  if (!safeEqual(mac, sign(expiry))) return false;
  const expiresAt = Number(expiry);
  return Number.isFinite(expiresAt) && expiresAt > Math.floor(Date.now() / 1000);
}

/**
 * Call this first in EVERY admin Server Function.
 *
 * Throws rather than returning a Response, because an action has no status code
 * to return. The check has to live inside each action: Server Functions POST to
 * the route of the page they're used on, so no page-level or proxy-level guard
 * covers them. The page's own isAdmin() call only decides what to render.
 */
export async function assertAdmin(): Promise<void> {
  if (!(await isAdmin())) throw new Error("Not authorised.");
}
