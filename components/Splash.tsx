import InitialsEntry from "@/components/InitialsEntry";
import type { Grid } from "@/lib/types";

/**
 * What a first-time visitor sees. It only ever renders for someone with no
 * initials yet, so it needs no dismissal state and no cookie of its own —
 * setting your initials is what makes it go away, permanently.
 *
 * A Server Component on purpose: it is static markup, and the whole point of a
 * splash is that it is the first paint. Nothing here should wait on JavaScript.
 *
 * It must never show real dots. This page renders for people who have not
 * committed, so the reveal gate applies to it exactly as it does everywhere
 * else — the diagram below is schematic, and the blurred marks are decoration,
 * not data.
 */
export default function Splash({ grid }: { grid: Grid }) {
  return (
    <div className="stack">
      <div>
        <h1>{grid.title ?? "This week"}</h1>
        <p className="meta">A new grid goes up each week. Put yourself on it.</p>
      </div>

      <div className="splash-plane">
        <div className="plane-label plane-label-y">{grid.y_top}</div>

        {/* Decorative: the axis labels around it carry the real information, and
            the steps below say what the picture is showing. */}
        <svg
          className="splash-square"
          viewBox="0 0 100 100"
          aria-hidden="true"
          focusable="false"
        >
          <rect className="splash-frame" x="0.5" y="0.5" width="99" height="99" rx="3" />
          <g className="splash-grid">
            <line x1="25" y1="0" x2="25" y2="100" />
            <line x1="75" y1="0" x2="75" y2="100" />
            <line x1="0" y1="25" x2="100" y2="25" />
            <line x1="0" y1="75" x2="100" y2="75" />
          </g>
          <g className="splash-axes">
            <line x1="50" y1="0" x2="50" y2="100" />
            <line x1="0" y1="50" x2="100" y2="50" />
          </g>
          {/* Everyone else, still hidden. The blur is the reveal gate, drawn. */}
          <g className="splash-hidden">
            <circle cx="31" cy="34" r="4" />
            <circle cx="69" cy="27" r="4" />
            <circle cx="63" cy="64" r="4" />
            <circle cx="20" cy="79" r="4" />
          </g>
          <circle className="splash-you" cx="43" cy="56" r="4.5" />
          <text className="splash-you-label" x="43" y="69" textAnchor="middle">
            you
          </text>
        </svg>

        <div className="plane-x-labels">
          <span className="plane-label plane-label-x">{grid.x_left}</span>
          <span className="plane-label plane-label-x">{grid.x_right}</span>
        </div>

        <div className="plane-label plane-label-y">{grid.y_bottom}</div>
      </div>

      <ol className="splash-steps">
        <li>Three initials — that&apos;s the whole sign-up.</li>
        <li>Drag yourself onto the square.</li>
        <li>Everyone else appears the moment you do.</li>
      </ol>

      <InitialsEntry cta="Continue" />
    </div>
  );
}
