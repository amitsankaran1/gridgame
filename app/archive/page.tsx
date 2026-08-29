import Link from "next/link";
import { archivedGrids } from "@/lib/queries";

// The other pages read cookies, which makes them dynamic automatically. This one
// doesn't, so without this Next tries to prerender it at build time — which
// means reaching for a database that isn't there yet during a build.
export const dynamic = "force-dynamic";

export default async function Archive() {
  const grids = await archivedGrids();

  if (grids.length === 0) {
    return (
      <div className="stack">
        <h1>Archive</h1>
        <p className="notice">
          Empty for now. The first grid to come down lands here, and stays.
        </p>
      </div>
    );
  }

  return (
    <div className="stack">
      <div>
        <h1>Archive</h1>
        <p className="meta">Every week the house has argued about so far.</p>
      </div>
      <ul className="card-list">
        {grids.map((grid) => (
          <li className="card" key={grid.id}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <Link className="card-title" href={`/archive/${grid.id}`}>
                {grid.title ?? `${grid.x_left} ↔ ${grid.x_right}`}
              </Link>
              <span className="meta">
                {new Date(grid.archived_at ?? grid.created_at).toLocaleDateString()}
              </span>
            </div>
            <span className="meta">
              {grid.x_left} ↔ {grid.x_right} · {grid.y_bottom} ↔ {grid.y_top}
            </span>
            <span className="meta">
              {grid.plot_count} {grid.plot_count === 1 ? "dot" : "dots"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
