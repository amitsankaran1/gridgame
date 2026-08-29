import type { Grid } from "@/lib/types";

/**
 * The first-timer explainer: this week's question as a schematic, not the real
 * board. It is the welcome half of onboarding — identity (initials + colour)
 * comes after "I'm in".
 *
 * Static markup on purpose: nothing here should wait on JavaScript. It must
 * never show real dots. This renders for people who have not committed, so the
 * reveal gate applies to it exactly as it does everywhere else — the diagram
 * is schematic, and the blurred marks are decoration, not data.
 */
export default function Splash({ grid }: { grid: Grid }) {
  return (
    <>
      <div>
        <h1>{grid.title ?? "This week"}</h1>
        <p className="meta">
          Everyone in the house puts themselves somewhere on this square. You
          get one dot, and you can move it whenever you change your mind.
        </p>
      </div>

      <div className="splash-plane">
        <div className="splash-label">{grid.y_top}</div>

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

        <div className="splash-x-labels">
          <span className="splash-label splash-label-x">{grid.x_left}</span>
          <span className="splash-label splash-label-x">{grid.x_right}</span>
        </div>

        <div className="splash-label">{grid.y_bottom}</div>
      </div>

      <ol className="splash-steps">
        <li>Three initials and a colour — that&apos;s the whole sign-up.</li>
        <li>Drag yourself onto the square.</li>
        <li>Everyone else appears the moment you do.</li>
      </ol>
    </>
  );
}
