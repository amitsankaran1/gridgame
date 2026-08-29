"use client";

import { useState, useTransition } from "react";
import { placeDot } from "@/app/actions";
import Plane, { PlotList } from "@/components/Plane";
import type { PlayerColor } from "@/lib/colors";
import type { Grid, PublicPlot } from "@/lib/types";

type Point = { x: number; y: number };

/** How many people are out there, said the way a person would say it. */
function headcount(count: number, committed: boolean): string {
  if (committed) {
    if (count <= 1) return "Just you, so far.";
    return `You and ${count - 1} ${count === 2 ? "other" : "others"}.`;
  }
  if (count === 0) return "Nobody here yet. You'd be first.";
  if (count === 1) return "One person is already out there. Place yourself to see where.";
  return `${count} people are already out there — hidden until you place yourself.`;
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
  color,
}: {
  grid: Grid;
  plots: PublicPlot[];
  myPlot: Point | null;
  count: number;
  color: PlayerColor;
}) {
  const [marker, setMarker] = useState<Point>(myPlot ?? { x: 0, y: 0 });
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);
  const [pending, startTransition] = useTransition();
  /**
   * True only for the render right after your first commit — the moment the
   * board actually opens up. A reload lands here as false, because the dots
   * were already there when the page loaded and re-animating them would make
   * the reveal into wallpaper.
   */
  const [revealing, setRevealing] = useState(false);

  const committed = myPlot !== null;
  const interactive = !committed || moving;

  function commit() {
    setError(null);
    const firstTime = !committed;
    startTransition(async () => {
      const result = await placeDot(marker.x, marker.y);
      if (result.error) setError(result.error);
      else {
        setMoving(false);
        if (firstTime) setRevealing(true);
      }
    });
  }

  return (
    <div className="stack">
      <div>
        <h1>{grid.title ?? "This week"}</h1>
        <p className="meta">{headcount(count, committed)}</p>
      </div>

      {!committed && (
        <p className="notice">
          Drop yourself wherever you think you belong. No peeking first — the
          board stays hidden until you commit your own dot, and you can always
          move it afterwards.
        </p>
      )}

      <Plane
        grid={grid}
        // While you are moving, the marker IS your dot — drawing the committed
        // one as well puts two marks and two labels on top of each other,
        // which is unreadable exactly when you most need to aim.
        plots={committed ? (moving ? plots.filter((plot) => !plot.isMe) : plots) : undefined}
        marker={interactive ? marker : null}
        onMarkerChange={interactive ? setMarker : undefined}
        markerColor={color}
        entrance={revealing}
      />

      {interactive ? (
        <div className="row">
          <button className="button" onClick={commit} disabled={pending}>
            {pending ? "Saving…" : committed ? "Move me here" : "Place me here"}
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
          <button
            className="button secondary"
            onClick={() => {
              // Coming back to move your dot is not a reveal, so retire the
              // entrance rather than replaying it on the way back out.
              setRevealing(false);
              setMoving(true);
            }}
          >
            Move me
          </button>
          <button className="button link" onClick={() => setShowList((v) => !v)}>
            {showList ? "hide list" : "show as list"}
          </button>
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {committed && showList && <PlotList plots={plots} />}
    </div>
  );
}
