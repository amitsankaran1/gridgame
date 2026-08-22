"use client";

import { useCallback, useRef, useState } from "react";
import type { Grid, PublicPlot } from "@/lib/types";

/**
 * Labels sit outside the square, but a dot at the very edge would still have its
 * own label clipped by `overflow: hidden`. So the plottable area is inset from
 * the square by a fixed number of PIXELS — not a percentage, because the label's
 * size doesn't scale with the square.
 */
const INSET_PX = 24;

/** Two dots closer than this share a ring instead of overlapping. */
const COLLISION_DISTANCE = 0.17;

/** -1…1 to a CSS offset inside the square. */
const toOffset = (n: number) =>
  `calc(${INSET_PX}px + ${(n + 1) / 2} * (100% - ${INSET_PX * 2}px))`;

/** The exact inverse of toOffset: a pixel offset back to -1…1. */
const fromPixels = (offset: number, size: number) =>
  ((offset - INSET_PX) / (size - INSET_PX * 2)) * 2 - 1;

const clamp = (n: number) => Math.min(1, Math.max(-1, n));

type Placed = {
  key: string;
  initials: string;
  isMe: boolean;
  /** Where the dot is drawn — the ring position, not the raw coordinate. */
  x: number;
  y: number;
  labelAbove: boolean;
};

/**
 * One faint circle drawn around a fanned-out cluster. Without it the ring lies:
 * three dots within 0.03 of each other get spread far enough apart to look like
 * a disagreement. The circle says "all of these really sit in here."
 */
type Ring = { key: string; cx: number; cy: number; radius: number };

/**
 * Greedy clustering by distance. Bucketing into grid cells is cheaper but
 * misses the common case: two dots a hair apart on opposite sides of a cell
 * boundary land in different buckets and overlap anyway.
 */
function clusterByDistance(plots: PublicPlot[]): PublicPlot[][] {
  const clusters: PublicPlot[][] = [];
  for (const plot of plots) {
    const near = clusters.find((cluster) =>
      cluster.some((other) => Math.hypot(other.x - plot.x, other.y - plot.y) < COLLISION_DISTANCE),
    );
    if (near) near.push(plot);
    else clusters.push([plot]);
  }
  return clusters;
}

function place(plots: PublicPlot[]): { dots: Placed[]; rings: Ring[] } {
  const placed: Placed[] = [];
  const rings: Ring[] = [];

  for (const cluster of clusterByDistance(plots)) {
    if (cluster.length === 1) {
      const only = cluster[0];
      placed.push({
        key: `${only.initials}-${only.x}-${only.y}`,
        initials: only.initials,
        isMe: only.isMe,
        x: only.x,
        y: only.y,
        labelAbove: false,
      });
      continue;
    }

    // Fan the tie out around its own centre so the group still reads as a tie.
    const cx = cluster.reduce((sum, p) => sum + p.x, 0) / cluster.length;
    const cy = cluster.reduce((sum, p) => sum + p.y, 0) / cluster.length;
    const radius = Math.min(0.32, COLLISION_DISTANCE * 0.75 + cluster.length * 0.025);
    rings.push({ key: `ring-${cx}-${cy}-${cluster.length}`, cx, cy, radius });

    cluster.forEach((plot, index) => {
      const angle = (index / cluster.length) * Math.PI * 2 - Math.PI / 2;
      const dx = Math.cos(angle) * radius;
      const dy = Math.sin(angle) * radius;
      placed.push({
        key: `${plot.initials}-${plot.x}-${plot.y}-${index}`,
        initials: plot.initials,
        isMe: plot.isMe,
        x: clamp(cx + dx),
        y: clamp(cy + dy),
        // The upper half of the ring labels upward, which doubles the vertical
        // breathing room the cluster has to work with.
        labelAbove: dy > 0,
      });
    });
  }

  return { dots: placed, rings };
}

type Props = {
  grid: Pick<Grid, "x_left" | "x_right" | "y_bottom" | "y_top">;
  /** Revealed dots. Omit while the board is still locked. */
  plots?: PublicPlot[];
  /** Your own position, shown as the draggable marker. */
  marker?: { x: number; y: number } | null;
  onMarkerChange?: (point: { x: number; y: number }) => void;
  /** Blur and dim the plotting area — used behind the locked state. */
  muted?: boolean;
};

export default function Plane({ grid, plots, marker, onMarkerChange, muted }: Props) {
  const squareRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const interactive = typeof onMarkerChange === "function";

  const pointToValue = useCallback((clientX: number, clientY: number) => {
    const square = squareRef.current;
    if (!square) return null;
    const rect = square.getBoundingClientRect();
    return {
      x: clamp(fromPixels(clientX - rect.left, rect.width)),
      // The DOM's y grows downward; the plane's grows up.
      y: clamp(-fromPixels(clientY - rect.top, rect.height)),
    };
  }, []);

  const handlePointer = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!onMarkerChange) return;
      const value = pointToValue(event.clientX, event.clientY);
      if (value) onMarkerChange(value);
    },
    [onMarkerChange, pointToValue],
  );

  const { dots, rings } = plots ? place(plots) : { dots: [], rings: [] };

  return (
    <div className="plane">
      <div className="plane-label plane-label-y">{grid.y_top}</div>

      <div
          ref={squareRef}
          className={`plane-square${muted ? " is-muted" : ""}${interactive ? " is-interactive" : ""}`}
          // `touch-action: none` lives on this class so a drag doesn't scroll
          // the page underneath it.
          role={interactive ? "application" : undefined}
          aria-label={interactive ? "Drag to place yourself on the grid" : undefined}
          onPointerDown={
            interactive
              ? (event) => {
                  // Capture, so a finger sliding off the square keeps driving
                  // the marker instead of dropping the drag.
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDragging(true);
                  handlePointer(event);
                }
              : undefined
          }
          onPointerMove={
            interactive
              ? (event) => {
                  if (dragging) handlePointer(event);
                }
              : undefined
          }
          onPointerUp={
            interactive
              ? (event) => {
                  setDragging(false);
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
              : undefined
          }
          onPointerCancel={interactive ? () => setDragging(false) : undefined}
        >
          <div className="plane-axis plane-axis-x" />
          <div className="plane-axis plane-axis-y" />

          {rings.map((ring) => (
            <div
              key={ring.key}
              className="plane-cluster"
              style={{
                left: toOffset(ring.cx),
                top: toOffset(-ring.cy),
                // The -1…1 span maps onto the inset area, so a radius of r
                // becomes a diameter of r × that span.
                width: `calc(${ring.radius} * (100% - ${INSET_PX * 2}px))`,
                height: `calc(${ring.radius} * (100% - ${INSET_PX * 2}px))`,
              }}
            />
          ))}

          {dots.map((dot) => (
            <div
              key={dot.key}
              className={`plane-dot${dot.isMe ? " is-me" : ""}${dot.labelAbove ? " label-above" : ""}`}
              style={{ left: toOffset(dot.x), top: toOffset(-dot.y) }}
            >
              <span className="plane-dot-mark" />
              <span className="plane-dot-label">{dot.initials}</span>
            </div>
          ))}

          {marker && (
            <div
              className="plane-marker"
              style={{ left: toOffset(marker.x), top: toOffset(-marker.y) }}
            >
              <span className="plane-marker-mark" />
              <span className="plane-dot-label">you</span>
            </div>
          )}
      </div>

      <div className="plane-x-labels">
        <span className="plane-label plane-label-x">{grid.x_left}</span>
        <span className="plane-label plane-label-x">{grid.x_right}</span>
      </div>

      <div className="plane-label plane-label-y">{grid.y_bottom}</div>
    </div>
  );
}

/** The same board as a table. Identity never has to rest on a dot's colour. */
export function PlotList({ plots }: { plots: PublicPlot[] }) {
  const round = (n: number) => (Math.round(n * 100) / 100).toFixed(2);
  return (
    <div className="table-wrap">
      <table className="plot-table">
        <thead>
          <tr>
            <th scope="col">Who</th>
            <th scope="col">x</th>
            <th scope="col">y</th>
          </tr>
        </thead>
        <tbody>
          {plots.map((plot, index) => (
            <tr key={`${plot.initials}-${index}`} className={plot.isMe ? "is-me" : undefined}>
              <td>
                {plot.initials}
                {plot.isMe && <span className="you-tag">you</span>}
              </td>
              <td>{round(plot.x)}</td>
              <td>{round(plot.y)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
