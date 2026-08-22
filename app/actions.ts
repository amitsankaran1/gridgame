"use server";

import { revalidatePath } from "next/cache";
import { queryOne } from "@/lib/db";
import { activeGrid, pendingIdeaCount } from "@/lib/queries";
import { getOrCreatePlayer } from "@/lib/session";
import { parseAxes, parseCoord, parseInitials } from "@/lib/validate";

/**
 * Actions report failure by returning it, not by throwing: these are expected
 * outcomes a person needs to read, not crashes. Arguments arrive from the
 * client, so every one of them is re-validated here — the client's own checks
 * are a convenience, never the boundary.
 */
export type ActionResult = { error?: string };

const PENDING_CAP = 5;

export async function setInitials(raw: string): Promise<ActionResult> {
  const initials = parseInitials(raw);
  if (!initials) return { error: "Initials must be three letters or numbers." };

  const player = await getOrCreatePlayer();
  await queryOne(`update players set initials = $2 where id = $1`, [
    player.id,
    initials,
  ]);
  revalidatePath("/");
  return {};
}

export async function placeDot(rawX: unknown, rawY: unknown): Promise<ActionResult> {
  const x = parseCoord(rawX);
  const y = parseCoord(rawY);
  if (x === null || y === null) return { error: "That isn't a point on the grid." };

  const player = await getOrCreatePlayer();
  if (!player.initials) return { error: "Set your initials first." };

  const grid = await activeGrid();
  if (!grid) return { error: "No grid is up right now." };

  // The unique (grid_id, player_id) constraint is what makes this a move rather
  // than a duplicate. initials are snapshotted so renaming yourself later
  // leaves old boards exactly as they were.
  await queryOne(
    `insert into plots (grid_id, player_id, initials, x, y)
     values ($1, $2, $3, $4, $5)
     on conflict (grid_id, player_id)
     do update set x = excluded.x, y = excluded.y,
                   initials = excluded.initials, updated_at = now()`,
    [grid.id, player.id, player.initials, x, y],
  );
  revalidatePath("/");
  return {};
}

export async function submitIdea(input: Record<string, unknown>): Promise<ActionResult> {
  const axes = parseAxes(input);
  if (!axes) {
    return { error: "All four labels are required, 40 characters or fewer each." };
  }

  const player = await getOrCreatePlayer();
  if ((await pendingIdeaCount(player.id)) >= PENDING_CAP) {
    return {
      error: `You already have ${PENDING_CAP} ideas waiting. Wait for one to be used.`,
    };
  }

  await queryOne(
    `insert into ideas (player_id, initials, x_left, x_right, y_bottom, y_top)
     values ($1, $2, $3, $4, $5, $6)`,
    [player.id, player.initials, axes.x_left, axes.x_right, axes.y_bottom, axes.y_top],
  );
  revalidatePath("/ideas");
  return {};
}
