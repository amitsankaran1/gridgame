import Link from "next/link";
import Board from "@/components/Board";
import Splash from "@/components/Splash";
import { colorFor } from "@/lib/colors";
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
        <h1>Between rounds</h1>
        <p className="notice">
          No grid is up at the moment. The next one goes up when someone puts it
          there — <Link href="/ideas">suggest one</Link>, or have a look at{" "}
          <Link href="/archive">what the house has argued about</Link> so far.
        </p>
      </div>
    );
  }

  // Having initials is the record that you have been here before, so this is
  // also what keeps the intro a once-ever thing rather than a weekly toll.
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
        color={colorFor(player.color, player.initials)}
      />
      <p className="meta" style={{ marginTop: 16 }}>
        You&apos;re <strong>{player.initials}</strong>.
      </p>
    </>
  );
}
