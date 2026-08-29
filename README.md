# gridgame

A weekly 2-axis grid. Every week a new x/y plane goes up — X: *chill ↔
not chill*, Y: *high maintenance ↔ low maintenance* — and friends open a link on
their phone, enter three initials, and drag themselves onto the square.

**The board stays hidden until you commit your own dot** — and when it opens up,
the dots land one at a time, yours first. Past weeks stay browsable at `/archive`.

A new player picks three initials and one of eight colours, once ever; after that
the same link drops them straight onto the board every week.

## Stack

- Next.js (App Router) + TypeScript, deployed on Vercel
- Postgres via `pg` on a `DATABASE_URL`, hosted on Supabase
- No component library. One hand-written stylesheet, Inter via `next/font/google`

`pg` rather than `@supabase/supabase-js` on purpose: Supabase hands you a plain
connection string, and `pg` means the whole app can run against a local Postgres
for testing. Use the **Transaction pooler** URI (port 6543) — the direct
connection on 5432 exhausts connections on serverless.

## Local

```bash
npm install
cp .env.example .env.local     # fill in the three values
npm run migrate                # runs every file in supabase/migrations, in order
npm run dev
```

Env vars:

| Name | What |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `ADMIN_PASSWORD` | The single operator password for `/admin` |
| `ADMIN_SESSION_SECRET` | `openssl rand -hex 32` |
| `NEXT_PUBLIC_SITE_URL` | Optional. Public origin for the share-preview image; inferred from `VERCEL_PROJECT_PRODUCTION_URL` on Vercel |

## Tests

```bash
npm run typecheck && npm run lint
npm run build && npm start                       # against a scratch database
npm i --no-save playwright-core                  # not a project dependency
BASE=http://localhost:3000 ADMIN_PASSWORD=... npm test
```

`tests/e2e.mjs` drives the built app in a browser against a real Postgres. There
is no unit layer on purpose: nearly everything here is a Server Component reading
Postgres, a Server Function writing it, or a drag landing on a pixel, and a mock
of any of those tests the mock. It covers the reveal gate (including that a
locked board's coordinates are absent from the raw response, not just hidden), a
drag round-tripping through the database, a three-way tie at 390px, keyboard-only
placement, all three tiers of the share fallback, the preview image's headers and
dimensions, admin authorisation by replaying a captured action without the cookie,
and the empty states. It also covers the colour palette resolving in both
schemes, and the halo that marks your own dot.

Run it against a throwaway database — it writes grids, players and ideas, and
takes the live grid down at the end.

## Shape

Pages are Server Components that read Postgres directly. Mutations are Server
Actions. There is no API layer and no `middleware.ts` — a Server Component can't
set a cookie, but it doesn't need to: someone who has never acted has no player
row, no plot, and therefore a correctly locked board. Identity is minted on the
first *write*, which is always a Server Function.

```
app/
  page.tsx              this week — onboarding, drag, commit, reveal
  actions.ts            setProfile · placeDot · submitIdea
  archive/page.tsx      past grids
  archive/[id]/page.tsx one past board, on its own URL
  ideas/page.tsx        suggest a grid, see your own submissions
  admin/page.tsx        the queue, put a grid up, take one down
  admin/actions.ts      signIn · signOut · putGridUp · takeGridDown · setIdeaStatus
  opengraph-image.tsx   the share preview, drawn per grid at request time
components/
  Plane.tsx             the square: axes, dots, collision fan-out, drag, arrow keys
  Board.tsx             marker state + commit (the only substantial client component)
  Onboarding.tsx        initials + colour, once ever, after Continue
  Splash.tsx            the first-timer page: intro, then who you are
  SplashFlow.tsx        Continue / Back between those two screens
  ShareButton.tsx       share sheet → clipboard → visible URL
  ShareDialog.tsx       the bottom sheet, on your first placement only
  ArchivedBoard.tsx  IdeaForm.tsx  AdminControls.tsx  Nav.tsx
lib/
  queries.ts            every read, including the reveal gate
  colors.ts             the eight player colours, and the fallback for null
  db.ts session.ts admin.ts validate.ts types.ts
supabase/migrations/    0001_init.sql  0002_player_color.sql
```

`lib/queries.ts` holds every read. `boardFor()` is the one that matters: it is the
only way to get plots, so a page cannot forget the gate.

`lib/session.ts` splits the two jobs on purpose. `getPlayer()` is read-only and
safe in a Server Component. `getOrCreatePlayer()` writes a cookie, so it is for
Server Functions only.

Every admin action starts with `assertAdmin()`. That check has to live inside each
action rather than in a page or a proxy: Server Functions POST to the route of the
page they're used on, so nothing outside them covers them. The `isAdmin()` call in
`app/admin/page.tsx` only decides what to render.

## Seven things that are easy to get wrong

**The reveal gate is server-side.** If the client filtered the dots they would be
one devtools tab away. `boardFor()` in `lib/queries.ts` doesn't *select* the
coordinates at all until you're revealed, so they can't reach the rendered payload
even by accident — stronger than returning a 403 and trusting the client not to
read the body. `player_id` collapses to a boolean `isMe` before leaving that
module: the client needs to know which dot is yours, not anyone's id.

**Colliding dots are fanned out.** A tie is unreadable otherwise.
`components/Plane.tsx` clusters greedily by distance (grid-bucketing misses two
dots a hair apart on opposite sides of a cell boundary), then places each cluster
on a ring, with the upper half of the ring labelling upward.

**Dots have a pixel inset.** The square is `overflow: hidden`, so a label below a
dot at y = -1 would be clipped. The inset is in pixels, not percent — the label's
size doesn't scale with the square — and `fromPixels` is the exact inverse of
`toOffset`.

**The square is not pointer-only.** It takes focus and answers the arrow keys,
because the marker starts at centre and a keyboard user with no other way to move
it could only ever commit to dead centre. `role="application"` is only honest
because `handleKey` really consumes those keys. The position also renders as a
sentence under the square — the one piece of feedback that serves a screen reader
and a sighted user with the same element.

**The splash is behind the reveal gate too.** `components/Splash.tsx` renders for
exactly the people who have not committed, so anything real on it would be a hole
in the gate. Its diagram is schematic — the blurred marks are decoration, not
data, and the blur is the gate drawn as a picture. `tests/e2e.mjs` asserts a
newcomer's splash carries no plotted player's initials.

**The share preview is drawn per request, on the Node runtime.**
`app/opengraph-image.tsx` reads the live grid through `pg`, so it cannot run on
Edge, and it is `force-dynamic` because a cached one would advertise the grid
that just got archived. It draws no plots — the image is public and the board is
not. Its type is sized for a chat thumbnail rather than for a 1200px canvas, and
both the type and the square step down together when the labels are long.

A preview only unfurls from a **publicly reachable** URL. A Vercel preview
deployment is behind deployment protection, so a link to one previews as
"Protected Deployment" no matter what this file draws. Share the production URL.

**A form that clears itself has to clear only what it sent.** A Server Action plus
its revalidation can outlast the moment someone starts typing the next entry, and
the fields stay editable throughout. `IdeaForm` and `NewGridForm` therefore reset
through a functional update that no-ops if anything changed since the submit.

**Which dot is yours is a shape, not a colour.** It used to be hue — yours was
the orange one — which stopped meaning anything the moment players could pick
their own. Ownership is now a halo ring on your own mark, so it survives eight
people choosing eight colours, and two of them choosing the same one. Identity
never rested on colour anyway: the initials label and `PlotList` carry that.

**The reveal animates once, and only on the commit that opens the board.**
`Board` catches the `false → true` edge of `committed` — a reload renders the
same dots with no entrance, because a reload is not a reveal, and neither is an
archived board. Only the *mark* scales: `.plane-dot-label` is already using
`transform` to centre itself, and a keyframe animating `transform` would throw
that away and hang every label off the wrong side of its dot.

Coordinates are stored normalised `-1…1` with **+y up**; the DOM's y grows
downward, so it's negated on render.

Player colour is the one identity field that is **not** snapshotted onto the
plot. `plots.initials` is, because renaming yourself must not rewrite old boards;
colour is joined from `players` at read time, so changing it repaints every board
you are on, past weeks included. That is a deliberate difference, not an
oversight — initials say who you were that week, colour is just how you like to
look.

## Weekly use

Go to `/admin`, promote an idea from the queue or type four labels. The previous
grid archives itself and stays readable at `/archive`. Same link every week.

## Deploy

1. Supabase → SQL Editor → run the files in `supabase/migrations/` in order.
2. Settings → Database → Connection string → **Transaction pooler** (6543).
3. Vercel → Add New → Project → import this repo → paste the three env vars.
