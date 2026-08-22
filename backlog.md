# gridgame — decisions and backlog

## Decided

Reasons included so these don't get re-litigated.

- **One global board.** Everyone shares the live grid. Per-group boards (rooms)
  are the escape hatch if it gets unreadable, not the starting point.
- **Cadence stays loose.** A new grid goes live when the operator promotes one;
  the old one archives itself. No cron, no clock — works for daily, weekly, or
  sporadic.
- **Postgres, not Notion.** Notion can't express `unique (grid_id, player_id)`,
  so a fast double-drag would leave two dots for one person. Its ~3 req/s
  per-integration limit also fails at exactly this app's load pattern: everyone
  opens the link at once. Notion stays a candidate for *authoring* grids later.
- **Identity is a cookie, and nothing else, for now.** Zero friction to place a
  first dot. The cost is that history dies with the cookie — see below.

## Backlog

- [ ] **Hide-others toggle.** Once you're revealed, let the viewer collapse the
      board down to just their own dot. Ship this when the board gets crowded
      enough to be overwhelming, not before.
- [ ] **Profile view.** Your own history: which grids you plotted on and where you
      put yourself, plus the ideas you submitted and which ones went live. The
      data already supports this — `plots` is keyed by player across every grid —
      it just isn't exposed anywhere.
- [ ] **Identity recovery.** A one-time code or link so history survives a new
      phone or a cleared browser. **Depends on nothing, but the profile view
      depends on it:** without recovery, a profile displays history that any
      cookie clear silently erases forever.
- [ ] **Rooms / per-group boards.** Deferred deliberately. This is where to go if
      a global board stays unreadable even with the hide toggle.
- [ ] **Rate limit on placing a dot.** Low stakes among friends, higher in public.
- [ ] **Initials collisions.** On a public board, three initials stop identifying
      anyone and nothing prevents impersonation. Decide whether to accept it or
      disambiguate.

## Not yet done

Everything here needs a live database, which doesn't exist yet.

- [ ] Provision Postgres and run `supabase/migrations/0001_init.sql`.
- [ ] Screenshot at 390px wide with a deliberate 3-way tie, and look at it. Both
      real bugs in the first build — an unreadable cluster and a clipped corner
      label — were invisible until rendered.
- [ ] Confirm a drag lands within ~1px of the pointer, round-tripped through the
      database.
- [ ] First push to `main`. The repo is still empty.
