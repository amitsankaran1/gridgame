create extension if not exists "pgcrypto";

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  initials text check (initials ~ '^[A-Z0-9]{3}$'),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists grids (
  id uuid primary key default gen_random_uuid(),
  title text,
  x_left text not null, x_right text not null,
  y_bottom text not null, y_top text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
-- Enforces "exactly one live grid" in the DB, not in app code. Rows with
-- is_active=false are excluded, so archived grids never collide.
create unique index if not exists grids_one_active on grids (is_active) where is_active;
create index if not exists grids_created_at_idx on grids (created_at desc);

create table if not exists plots (
  id uuid primary key default gen_random_uuid(),
  grid_id uuid not null references grids(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  -- Snapshotted: changing your initials later must not rewrite old boards.
  initials text not null check (initials ~ '^[A-Z0-9]{3}$'),
  x double precision not null check (x >= -1 and x <= 1),
  y double precision not null check (y >= -1 and y <= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (grid_id, player_id)   -- makes a re-plot a move, not a duplicate
);
create index if not exists plots_grid_idx on plots (grid_id);

create table if not exists ideas (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references players(id) on delete set null,
  initials text,
  x_left text not null, x_right text not null,
  y_bottom text not null, y_top text not null,
  status text not null default 'pending'
    check (status in ('pending','used','passed')),
  used_grid_id uuid references grids(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists ideas_status_idx on ideas (status, created_at desc);

-- Supabase exposes every table over a public REST API to `anon` by default.
-- RLS on with zero policies shuts that door; the app connects as the owner,
-- which bypasses RLS, so this costs nothing.
alter table players enable row level security;
alter table grids   enable row level security;
alter table plots   enable row level security;
alter table ideas   enable row level security;
