export type Grid = {
  id: string;
  title: string | null;
  x_left: string;
  x_right: string;
  y_bottom: string;
  y_top: string;
  is_active: boolean;
  created_at: string;
  archived_at: string | null;
};

/** A dot as the client is allowed to see it: no player_id, ever. */
export type PublicPlot = {
  initials: string;
  x: number;
  y: number;
  isMe: boolean;
};

export type Idea = {
  id: string;
  initials: string | null;
  x_left: string;
  x_right: string;
  y_bottom: string;
  y_top: string;
  status: "pending" | "used" | "passed";
  created_at: string;
};

export type ArchiveEntry = Grid & { plot_count: number };
