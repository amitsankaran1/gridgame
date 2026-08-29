"use client";

import { useState, useTransition } from "react";
import { placeDot } from "@/app/actions";
import Plane, { PlotList } from "@/components/Plane";
import ShareButton from "@/components/ShareButton";
import ShareDialog from "@/components/ShareDialog";
import type { Grid, PublicPlot } from "@/lib/types";

type Point = { x: number; y: number };

/**
 * The line under the title. Zero needs a sentence of its own: "0 people are
 * already on the board — hidden until you place yourself" promises a crowd that
 * isn't there, and it is the first thing anyone reads on a brand-new grid.
 */
function headline(count: number, committed: boolean): string {
  if (!committed) {
    if (count === 0) return "Nobody has plotted yet. Go first.";
    const who = count === 1 ? "person is" : "people are";
    return `${count} ${who} already on the board — hidden until you place yourself.`;
  }
  // Committed means at least your own dot is counted, so 0 is unreachable here.
  if (count === 1) return "You're the first.";
  return `${count} people have plotted.`;
}

/**
 * The only substantial client component: it owns drag state and calls the
 * action. Everything it renders arrives as props from the server, already
 * filtered by the reveal gate — when the board is locked, `plots` is empty
 * because the coordinates were never queried.
 */
export default function Board({
  grid,
  plots,
  myPlot,
  count,
}: {
  grid: Grid;
  plots: PublicPlot[];
  myPlot: Point | null;
  count: number;
}) {
  const [marker, setMarker] = useState<Point>(myPlot ?? { x: 0, y: 0 });
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [justJoined, setJustJoined] = useState(false);
  const [pending, startTransition] = useTransition();

  const committed = myPlot !== null;
  const interactive = !committed || moving;

  function commit() {
    setError(null);
    // Read it before the action: the revalidation flips `committed` underneath
    // us, so afterwards there is no way to tell a first placement from a move.
    const isFirstPlacement = !committed;
    startTransition(async () => {
      const result = await placeDot(marker.x, marker.y);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMoving(false);
      if (isFirstPlacement) setJustJoined(true);
    });
  }

  const question = `${grid.x_left} ↔ ${grid.x_right}`;

  return (
    <div className="stack">
      <div>
        <h1>{grid.title ?? "This week"}</h1>
        <p className="meta">
          {headline(count, committed)}
        </p>
      </div>

      <Plane
        grid={grid}
        // While you are moving, the marker IS your dot — drawing the committed
        // one as well puts two orange marks and two labels on top of each other,
        // which is unreadable exactly when you most need to aim.
        plots={committed ? (moving ? plots.filter((plot) => !plot.isMe) : plots) : undefined}
        marker={interactive ? marker : null}
        onMarkerChange={interactive ? setMarker : undefined}
      />

      {interactive ? (
        <div className="row">
          <button className="button" onClick={commit} disabled={pending}>
            {pending ? "Saving…" : committed ? "Move my dot here" : "Place me here"}
          </button>
          {committed && (
            <button
              className="button link"
              onClick={() => {
                setMoving(false);
                setMarker(myPlot);
              }}
            >
              cancel
            </button>
          )}
        </div>
      ) : (
        <div className="row">
          <button className="button secondary" onClick={() => setMoving(true)}>
            Move my dot
          </button>
          {/* Only here: sharing is offered once you have skin in the game, and
              never while the board is still locked to you. */}
          <ShareButton question={question} />
          <button className="button link" onClick={() => setShowList((v) => !v)}>
            {showList ? "hide list" : "show as list"}
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {!committed && (
        <p className="notice">
          The board stays hidden until you commit your own dot. You can move it
          afterwards.
        </p>
      )}

      {committed && showList && <PlotList plots={plots} />}

      <ShareDialog
        open={justJoined}
        onClose={() => setJustJoined(false)}
        question={question}
      />
    </div>
  );
}
