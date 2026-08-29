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
- **Identity is a cookie, and nothing else, for now.** Near-zero friction to
  place a first dot. The cost is that history dies with the cookie — see below.
- **Onboarding is two screens, once ever.** The week's question first, then
  initials and a colour. Showing someone what the house is arguing about before
  asking them to name themselves is the whole point of the ordering; a third
  "how it works" screen was considered and dropped, because the drag hint already
  lives under the square and the reveal gate is explained on the board itself.
  Having initials *is* the record that you have been here, so nothing persists.
- **Colour is a curated palette of eight, not a free picker.** A dot has to stay
  legible on two grounds; a free hex lets someone pick the dark background and
  vanish. Each entry is defined twice in `globals.css` and clears 4.5:1 on its
  own ground.

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
      disambiguate. Colour helps a little and solves nothing: two players can
      pick the same one, and the halo only tells you which dot is *yours*.
- [ ] **Let the board say something about itself.** The data is already there to
      derive a sentence — everyone is clustered in one corner, you are the
      outlier, you are closest to JKM. One line under the square is the
      difference between a chart and a conversation. Pure server-side work over
      what `boardFor()` already returns.
- [ ] **Archive thumbnails.** The archive is the warmest thing in the product
      conceptually — old weeks, where everyone stood — and it currently renders
      as a filing cabinet: title, date, "6 dots". Tiny planes would make it a
      photo album.

## Not yet done

- [ ] Provision Postgres and run `supabase/migrations/0001_init.sql`. The app and
      its tests have only ever run against a local Postgres, so the Supabase
      transaction-pooler URI is the one part of the setup nothing has exercised.
- [ ] Deploy to Vercel with the three env vars set.

### Done

- [x] Warmth pass on the game page: a copy rewrite that says what is true
      socially rather than what is true in the database, a staggered entrance for
      the dots at the moment of reveal, player-chosen colours, and the two-screen
      intro. Screenshotted at 390px in both schemes before it was called done —
      the swatches wrapped 7+1 and the colour preview read as a ninth swatch, and
      neither was visible until rendered.
- [x] Screenshot at 390px wide with a deliberate 3-way tie, and look at it. Both
      real bugs in the first build — an unreadable cluster and a clipped corner
      label — were invisible until rendered. The tie now also has a regression
      test: `tests/e2e.mjs` asserts no label escapes the square, no two marks
      overlap, and the page never scrolls sideways.
- [x] Confirm a drag lands within ~1px of the pointer, round-tripped through the
      database. Asserted to within 0.02 of the plane's -1…1 range.
- [x] End-to-end tests. See the Tests section of the README.
