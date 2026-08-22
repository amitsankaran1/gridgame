import { query, queryOne } from "./db";
import type { ArchiveEntry, Grid, Idea, PublicPlot } from "./types";

export async function activeGrid(): Promise<Grid | null> {
  return queryOne<Grid>(`select * from grids where is_active limit 1`);
}

export async function gridById(id: string): Promise<Grid | null> {
  return queryOne<Grid>(`select * from grids where id = $1`, [id]);
}

export async function myPlot(
  gridId: string,
  playerId: string,
): Promise<{ x: number; y: number } | null> {
  return queryOne<{ x: number; y: number }>(
    `select x, y from plots where grid_id = $1 and player_id = $2`,
    [gridId, playerId],
  );
}

export async function plotCount(gridId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count from plots where grid_id = $1`,
    [gridId],
  );
  return Number(row?.count ?? 0);
}

export type Board = {
  grid: Grid;
  /** Empty whenever revealed is false — see below. */
  plots: PublicPlot[];
  revealed: boolean;
  myPlot: { x: number; y: number } | null;
  count: number;
};

/**
 * THE REVEAL GATE. The board stays hidden until you commit your own dot.
 *
 * The gate lives in this function rather than in a page or a route, because
 * this is the only way to get plots at all — so a caller cannot forget to
 * check. When the board is locked, the coordinates are never selected from
 * Postgres, which means they can't reach the rendered payload even by mistake.
 * That is strictly stronger than returning a 403 and trusting the client not to
 * read the body it was sent.
 */
export async function boardFor(
  gridId: string,
  playerId: string | null,
): Promise<Board | null> {
  const grid = await gridById(gridId);
  if (!grid) return null;

  const mine = playerId ? await myPlot(gridId, playerId) : null;
  // An archived board is open reading: the week is over, there's nothing left
  // to spoil.
  const revealed = mine !== null || grid.archived_at !== null;

  return {
    grid,
    revealed,
    myPlot: mine,
    count: await plotCount(gridId),
    plots: revealed ? await publicPlots(gridId, playerId) : [],
  };
}

/**
 * player_id collapses to a boolean before it leaves this module: the client
 * needs to know which dot is yours and has no business seeing anyone's id.
 */
async function publicPlots(
  gridId: string,
  playerId: string | null,
): Promise<PublicPlot[]> {
  const rows = await query<{ initials: string; x: number; y: number; player_id: string }>(
    `select initials, x, y, player_id from plots
      where grid_id = $1 order by created_at asc`,
    [gridId],
  );
  return rows.map((row) => ({
    initials: row.initials,
    x: row.x,
    y: row.y,
    isMe: playerId !== null && row.player_id === playerId,
  }));
}

export async function archivedGrids(): Promise<ArchiveEntry[]> {
  const rows = await query<Grid & { plot_count: string }>(
    `select g.*, count(p.id)::text as plot_count
       from grids g left join plots p on p.grid_id = g.id
      where g.archived_at is not null
      group by g.id
      order by g.archived_at desc`,
  );
  return rows.map((row) => ({ ...row, plot_count: Number(row.plot_count) }));
}

export async function myIdeas(playerId: string): Promise<Idea[]> {
  return query<Idea>(
    `select id, initials, x_left, x_right, y_bottom, y_top, status, created_at
       from ideas where player_id = $1 order by created_at desc`,
    [playerId],
  );
}

/** Admin only. Pending first, then everything else. */
export async function allIdeas(): Promise<Idea[]> {
  return query<Idea>(
    `select id, initials, x_left, x_right, y_bottom, y_top, status, created_at
       from ideas order by (status = 'pending') desc, created_at desc`,
  );
}

export async function pendingIdeaCount(playerId: string): Promise<number> {
  const row = await queryOne<{ count: string }>(
    `select count(*)::text as count from ideas
      where player_id = $1 and status = 'pending'`,
    [playerId],
  );
  return Number(row?.count ?? 0);
}
