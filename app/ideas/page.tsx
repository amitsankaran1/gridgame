import IdeaForm from "@/components/IdeaForm";
import { myIdeas } from "@/lib/queries";
import { getPlayer } from "@/lib/session";

export default async function Ideas() {
  const player = await getPlayer();
  // Nobody exists until they act, so someone who has never submitted an idea
  // has no row and therefore nothing to list.
  const ideas = player ? await myIdeas(player.id) : [];

  return (
    <div className="stack">
      <div>
        <h1>Suggest a grid</h1>
        <p className="meta">Four ends of two axes. Good ones go up on a future week.</p>
      </div>

      <IdeaForm />

      <div className="section">
        <h2>Yours</h2>
        {ideas.length === 0 ? (
          <p className="meta">You haven&apos;t sent any yet.</p>
        ) : (
          <ul className="card-list" style={{ marginTop: 12 }}>
            {ideas.map((idea) => (
              <li className="card" key={idea.id}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="card-title">
                    {idea.x_left} ↔ {idea.x_right}
                  </span>
                  <span className="tag">{idea.status}</span>
                </div>
                <span className="meta">
                  {idea.y_bottom} ↔ {idea.y_top}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
