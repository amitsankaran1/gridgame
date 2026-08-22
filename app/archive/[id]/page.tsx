import Link from "next/link";
import { notFound } from "next/navigation";
import ArchivedBoard from "@/components/ArchivedBoard";
import { boardFor } from "@/lib/queries";
import { getPlayer } from "@/lib/session";
import { isUuid } from "@/lib/validate";

export default async function ArchivedGrid({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!isUuid(id)) notFound();

  const player = await getPlayer();
  // boardFor reveals an archived grid to anyone — the week is over, so there is
  // nothing left to spoil. Passing the player only marks which dot is theirs.
  const board = await boardFor(id, player?.id ?? null);
  if (!board || board.grid.archived_at === null) notFound();

  return (
    <div className="stack">
      <div>
        <h1>{board.grid.title ?? "A past week"}</h1>
        <p className="meta">
          {board.count} {board.count === 1 ? "dot" : "dots"} ·{" "}
          {new Date(board.grid.archived_at).toLocaleDateString()}
        </p>
      </div>
      <ArchivedBoard grid={board.grid} plots={board.plots} />
      <p className="meta">
        <Link href="/archive">← all weeks</Link>
      </p>
    </div>
  );
}
