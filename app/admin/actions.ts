"use server";

import { revalidatePath } from "next/cache";
import {
  assertAdmin,
  checkPassword,
  endAdminSession,
  startAdminSession,
} from "@/lib/admin";
import { queryOne, transaction } from "@/lib/db";
import type { Grid, Idea } from "@/lib/types";
import { isUuid, parseAxes, parseTitle } from "@/lib/validate";
import type { ActionResult } from "../actions";

export async function signIn(password: unknown): Promise<ActionResult> {
  if (!checkPassword(password)) return { error: "Wrong password." };
  await startAdminSession();
  revalidatePath("/admin");
  return {};
}

export async function signOut(): Promise<ActionResult> {
  await endAdminSession();
  revalidatePath("/admin");
  return {};
}

/**
 * Put a grid up, either from a queued idea or from four typed labels.
 *
 * Archiving the old grid, inserting the new one and marking the idea used all
 * happen in one transaction, so there is never a moment with two live grids or
 * an idea marked used against a grid that failed to insert.
 */
export async function putGridUp(input: Record<string, unknown>): Promise<ActionResult> {
  await assertAdmin();

  const title = parseTitle(input.title);
  if (input.title && title === null) {
    return { error: "Title must be 80 characters or fewer." };
  }

  const usingIdea = input.ideaId !== undefined && input.ideaId !== null && input.ideaId !== "";
  if (usingIdea && !isUuid(input.ideaId)) return { error: "That idea id isn't valid." };

  try {
    await transaction(async (run) => {
      let axes = parseAxes(input);
      let ideaId: string | null = null;

      if (usingIdea) {
        ideaId = input.ideaId as string;
        const [idea] = await run<Idea>(
          `select id, x_left, x_right, y_bottom, y_top from ideas
            where id = $1 and status = 'pending' for update`,
          [ideaId],
        );
        if (!idea) throw new Error("NO_IDEA");
        axes = {
          x_left: idea.x_left,
          x_right: idea.x_right,
          y_bottom: idea.y_bottom,
          y_top: idea.y_top,
        };
      }
      if (!axes) throw new Error("NO_AXES");

      // Archive first: the grids_one_active index would reject the insert
      // otherwise, which is exactly the protection we want.
      await run(`update grids set is_active = false, archived_at = now() where is_active`);

      const [created] = await run<Grid>(
        `insert into grids (title, x_left, x_right, y_bottom, y_top)
         values ($1, $2, $3, $4, $5) returning *`,
        [title, axes.x_left, axes.x_right, axes.y_bottom, axes.y_top],
      );

      if (ideaId) {
        await run(`update ideas set status = 'used', used_grid_id = $2 where id = $1`, [
          ideaId,
          created.id,
        ]);
      }
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "NO_IDEA") return { error: "That idea is gone or already used." };
    if (message === "NO_AXES") {
      return { error: "All four labels are required, 40 characters or fewer each." };
    }
    throw err;
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/archive");
  return {};
}

/** Take the live grid down. It stays readable in the archive. */
export async function takeGridDown(): Promise<ActionResult> {
  await assertAdmin();
  const grid = await queryOne<Grid>(
    `update grids set is_active = false, archived_at = now() where is_active returning *`,
  );
  if (!grid) return { error: "No grid is up right now." };
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/archive");
  return {};
}

/** Pass on an idea, or put a passed one back in the queue. */
export async function setIdeaStatus(
  id: unknown,
  status: unknown,
): Promise<ActionResult> {
  await assertAdmin();
  if (!isUuid(id)) return { error: "That idea id isn't valid." };
  if (status !== "pending" && status !== "passed") {
    return { error: "Status must be pending or passed." };
  }
  // 'used' is set only by promoting an idea into a grid, never by hand.
  const idea = await queryOne<Idea>(
    `update ideas set status = $2 where id = $1 and status <> 'used' returning id`,
    [id, status],
  );
  if (!idea) return { error: "No such idea." };
  revalidatePath("/admin");
  return {};
}
