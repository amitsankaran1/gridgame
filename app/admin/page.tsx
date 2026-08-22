import AdminActions, { AdminLogin, NewGridForm } from "@/components/AdminControls";
import { isAdmin } from "@/lib/admin";
import { activeGrid, allIdeas } from "@/lib/queries";

export default async function Admin() {
  // Cosmetic only — it decides what to render. Every action re-checks for
  // itself, because Server Functions POST to this page's own route and are not
  // covered by any guard out here.
  if (!(await isAdmin())) {
    return (
      <div className="stack">
        <h1>Admin</h1>
        <AdminLogin />
      </div>
    );
  }

  const [grid, ideas] = await Promise.all([activeGrid(), allIdeas()]);
  const pending = ideas.filter((idea) => idea.status === "pending");
  const rest = ideas.filter((idea) => idea.status !== "pending");

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1>Admin</h1>
        <AdminActions kind="signOut" />
      </div>

      <div>
        <h2>Live grid</h2>
        {grid ? (
          <div className="card" style={{ marginTop: 10 }}>
            <span className="card-title">{grid.title ?? "Untitled"}</span>
            <span className="meta">
              {grid.x_left} ↔ {grid.x_right} · {grid.y_bottom} ↔ {grid.y_top}
            </span>
            <div className="row">
              <AdminActions kind="takeDown" />
            </div>
          </div>
        ) : (
          <p className="meta">Nothing is up.</p>
        )}
      </div>

      <div className="section">
        <h2>Queue</h2>
        {pending.length === 0 ? (
          <p className="meta">Empty.</p>
        ) : (
          <ul className="card-list" style={{ marginTop: 10 }}>
            {pending.map((idea) => (
              <li className="card" key={idea.id}>
                <span className="card-title">
                  {idea.x_left} ↔ {idea.x_right}
                </span>
                <span className="meta">
                  {idea.y_bottom} ↔ {idea.y_top} · {idea.initials ?? "anon"}
                </span>
                <div className="row">
                  <AdminActions kind="promote" ideaId={idea.id} />
                  <AdminActions kind="pass" ideaId={idea.id} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="section">
        <h2>Or type one</h2>
        <NewGridForm />
      </div>

      {rest.length > 0 && (
        <div className="section">
          <details>
            <summary>Passed and used ({rest.length})</summary>
            <ul className="card-list">
              {rest.map((idea) => (
                <li className="card" key={idea.id}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="card-title">
                      {idea.x_left} ↔ {idea.x_right}
                    </span>
                    <span className="tag">{idea.status}</span>
                  </div>
                  {idea.status === "passed" && (
                    <div className="row">
                      <AdminActions kind="requeue" ideaId={idea.id} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
