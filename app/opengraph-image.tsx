import { ImageResponse } from "next/og";
import { activeGrid, plotCount } from "@/lib/queries";

// Node, not Edge: this reads Postgres through `pg`, a Node library that is
// already in serverExternalPackages.
export const runtime = "nodejs";
// The picture that lands in a group chat has to be *this* week's question. A
// cached one would advertise the grid that just got archived.
export const dynamic = "force-dynamic";

export const alt = "This week's grid";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The light palette, inlined: an OG image has no viewer preference to read.
const INK = "#14171a";
const INK_SOFT = "#5b6472";
const LINE = "#dfe3e8";
const LINE_FAINT = "#eef1f4";
const MARKER = "#c2410c";

/** Wide enough for a long label to wrap and still leave the square its room. */
const SIDE = 300;

/*
 * Sized for a chat thumbnail, not for this canvas. iMessage and WhatsApp render
 * a link preview a few hundred pixels wide, so a 1200px image is seen at about
 * a quarter scale — type that looks generous here is barely legible there. The
 * labels are therefore large and set in full-strength ink rather than the muted
 * grey the app uses, and the square gives up room to them.
 *
 * Labels are capped at 40 characters, and four long ones wrap to three lines
 * each, which at full size would crowd the wordmark and run off the bottom. So
 * both the type and the square step down together on the longest label — short
 * ones, which is nearly always, stay big.
 */
function scale(labels: string[]) {
  // Math.max() of nothing is -Infinity, and the no-grid branch has no labels.
  const longest = Math.max(0, ...labels.map((label) => label.length));
  if (longest > 24) return { label: 28, square: 240 };
  if (longest > 15) return { label: 34, square: 280 };
  return { label: 40, square: 300 };
}

function Label({
  text,
  align,
  size: fontSize,
  width,
}: {
  text: string;
  align: "left" | "right" | "center";
  size: number;
  width: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        width,
        justifyContent:
          align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
        textAlign: align,
        fontSize,
        lineHeight: 1.2,
        fontWeight: 500,
        color: INK,
      }}
    >
      {text}
    </div>
  );
}

export default async function Image() {
  const grid = await activeGrid();
  const count = grid ? await plotCount(grid.id) : 0;
  const { label, square: SQUARE } = scale(
    grid ? [grid.x_left, grid.x_right, grid.y_bottom, grid.y_top] : [],
  );

  const frame = (children: React.ReactNode) => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
        padding: 48,
        background: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", fontSize: 32, fontWeight: 600, color: INK }}>
          gridgame
        </div>
        <div style={{ display: "flex", fontSize: 30, color: INK_SOFT }}>
          {count === 0
            ? "be the first"
            : `${count} ${count === 1 ? "person" : "people"} so far`}
        </div>
      </div>
      {children}
    </div>
  );

  if (!grid) {
    return new ImageResponse(
      frame(
        <div
          style={{
            display: "flex",
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            fontSize: 56,
            color: INK_SOFT,
          }}
        >
          Nothing up yet
        </div>,
      ),
      size,
    );
  }

  return new ImageResponse(
    frame(
      // x labels sit either side rather than underneath. The app stacks them
      // below because a phone is narrow; 1200px is not, and the quadrant
      // reading is what makes the question legible at thumbnail size.
      <div
        style={{
          display: "flex",
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          gap: 32,
        }}
      >
        <Label text={grid.x_left} align="right" size={label} width={SIDE} />

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <Label text={grid.y_top} align="center" size={label} width={SQUARE} />

          <div
            style={{
              display: "flex",
              position: "relative",
              width: SQUARE,
              height: SQUARE,
              border: `2px solid ${LINE}`,
              borderRadius: 10,
            }}
          >
            <div style={{ position: "absolute", left: SQUARE / 4, top: 0, width: 1, height: SQUARE, background: LINE_FAINT }} />
            <div style={{ position: "absolute", left: (SQUARE / 4) * 3, top: 0, width: 1, height: SQUARE, background: LINE_FAINT }} />
            <div style={{ position: "absolute", top: SQUARE / 4, left: 0, height: 1, width: SQUARE, background: LINE_FAINT }} />
            <div style={{ position: "absolute", top: (SQUARE / 4) * 3, left: 0, height: 1, width: SQUARE, background: LINE_FAINT }} />
            <div style={{ position: "absolute", left: SQUARE / 2, top: 0, width: 1, height: SQUARE, background: LINE }} />
            <div style={{ position: "absolute", top: SQUARE / 2, left: 0, height: 1, width: SQUARE, background: LINE }} />

            {/* An empty ring at dead centre: the invitation, and the only thing
                on here that could ever have been real data. It isn't — no plot
                is ever drawn, because this image is public and the board is
                not. */}
            <div
              style={{
                position: "absolute",
                left: SQUARE / 2 - 21,
                top: SQUARE / 2 - 21,
                width: 42,
                height: 42,
                borderRadius: 21,
                border: `6px solid ${MARKER}`,
              }}
            />
          </div>

          <Label text={grid.y_bottom} align="center" size={label} width={SQUARE} />
        </div>

        <Label text={grid.x_right} align="left" size={label} width={SIDE} />
      </div>,
    ),
    size,
  );
}
