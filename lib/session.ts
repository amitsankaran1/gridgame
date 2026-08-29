import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { queryOne } from "./db";
import { isUuid } from "./validate";

export const PLAYER_COOKIE = "gg_player";
const ONE_YEAR = 60 * 60 * 24 * 365;

export type Player = { id: string; initials: string | null; color: string | null };

/**
 * The player this request belongs to, or null.
 *
 * Read-only, so it is safe in a Server Component. Null is a legitimate answer,
 * not an error: someone who has never acted has no row, and no row means no
 * plot, which means the board is correctly locked for them.
 *
 * The cookie's id is never trusted on its own — the row is looked up every time.
 */
export async function getPlayer(): Promise<Player | null> {
  const jar = await cookies();
  const id = jar.get(PLAYER_COOKIE)?.value;
  if (!id) return null;
  try {
    return await queryOne<Player>(
      `select id, initials, color from players where id = $1`,
      [id],
    );
  } catch {
    // A cookie carrying a non-uuid would make Postgres throw. Fail soft.
    return null;
  }
}

/**
 * The player for this request, minting one if this is their first action.
 *
 * Server Functions and Route Handlers only — it writes a cookie, and HTTP can't
 * set cookies once a render has started streaming.
 */
export async function getOrCreatePlayer(): Promise<Player> {
  const existing = await getPlayer();
  if (existing) return existing;

  const jar = await cookies();
  // Reuse the id already in the cookie when there is one, so a wiped database
  // doesn't hand the same browser a second identity.
  const id = jar.get(PLAYER_COOKIE)?.value ?? randomUUID();
  const created = await queryOne<Player>(
    `insert into players (id) values ($1)
     on conflict (id) do update set id = excluded.id
     returning id, initials, color`,
    [isUuid(id) ? id : randomUUID()],
  );
  if (!created) throw new Error("could not create player");

  jar.set(PLAYER_COOKIE, created.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_YEAR,
  });
  return created;
}
