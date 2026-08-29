import Board from "@/components/Board";
import Splash from "@/components/Splash";
import { activeGrid, boardFor } from "@/lib/queries";
import { getPlayer } from "@/lib/session";

export default async function Home() {
  // No cookie means no player, which means no plot, which means the board is
  // correctly locked. Nothing needs to be minted just to look at the page.
  const player = await getPlayer();
  const grid = await activeGrid();

  if (!grid) {
    return (
      <div className="stack">
        <h1>Nothing up yet</h1>
        <p className="notice">
          No grid is live right now. Check back, or leave an idea for the next one.
        </p>
      </div>
    );
  }

  // No initials yet means a first-timer, so this is where the explanation goes.
  // Setting them is what retires it — there is no dismissal state to keep.
  if (!player?.initials) return <Splash grid={grid} />;

  const board = await boardFor(grid.id, player.id);
  if (!board) return null;

  return (
    <>
      <Board
        grid={board.grid}
        plots={board.plots}
        myPlot={board.myPlot}
        count={board.count}
      />
      <p className="meta" style={{ marginTop: 16 }}>
        Signed in as <strong>{player.initials}</strong>.
      </p>
    </>
  );
}
