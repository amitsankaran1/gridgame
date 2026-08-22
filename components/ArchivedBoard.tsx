"use client";

import { useState } from "react";
import Plane, { PlotList } from "@/components/Plane";
import type { Grid, PublicPlot } from "@/lib/types";

/** A finished board. Read-only, so the only interaction is the list toggle. */
export default function ArchivedBoard({
  grid,
  plots,
}: {
  grid: Grid;
  plots: PublicPlot[];
}) {
  const [showList, setShowList] = useState(false);
  return (
    <div>
      <Plane grid={grid} plots={plots} />
      <button className="button link" onClick={() => setShowList((v) => !v)}>
        {showList ? "hide list" : "show as list"}
      </button>
      {showList && <PlotList plots={plots} />}
    </div>
  );
}
