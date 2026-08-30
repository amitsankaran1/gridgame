import { ImageResponse } from "next/og";
import { imLine, SIT_DARE, type ShareCard } from "./share";

export const shareOgSize = { width: 1200, height: 630 };

const INK = "#14171a";
const INK_SOFT = "#5b6472";
const LINE = "#dfe3e8";
const LINE_FAINT = "#eef1f4";
const MARKER = "#c2410c";

const SIDE = 300;

function scale(labels: string[]) {
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

/**
 * Empty board, this share's four labels, one halo at the 0–1 plot.
 * No other initials, no other dots, no live-grid lookup.
 */
export function shareImageResponse(card: ShareCard | null): ImageResponse {
  const headline = card ? imLine(card) : SIT_DARE;
  const { label, square: SQUARE } = scale(
    card ? [card.xl, card.xr, card.yb, card.yt] : [],
  );

  const halo = card
    ? {
        // 0–1, y up — same mapping Plane uses after the −1…1 → inset remap.
        left: card.x * SQUARE - 21,
        top: (1 - card.y) * SQUARE - 21,
      }
    : null;

  return new ImageResponse(
    (
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
        <div style={{ display: "flex", fontSize: 32, fontWeight: 600, color: INK }}>
          gridgame
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            marginTop: 12,
            gap: 4,
          }}
        >
          <div style={{ display: "flex", fontSize: 40, fontWeight: 600, color: INK }}>
            {headline}
          </div>
          {card && (
            <div style={{ display: "flex", fontSize: 30, color: INK_SOFT }}>{SIT_DARE}</div>
          )}
        </div>

        {card ? (
          <div
            style={{
              display: "flex",
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              gap: 32,
            }}
          >
            <Label text={card.xl} align="right" size={label} width={SIDE} />

            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <Label text={card.yt} align="center" size={label} width={SQUARE} />

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
                <div
                  style={{
                    position: "absolute",
                    left: SQUARE / 4,
                    top: 0,
                    width: 1,
                    height: SQUARE,
                    background: LINE_FAINT,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: (SQUARE / 4) * 3,
                    top: 0,
                    width: 1,
                    height: SQUARE,
                    background: LINE_FAINT,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: SQUARE / 4,
                    left: 0,
                    height: 1,
                    width: SQUARE,
                    background: LINE_FAINT,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: (SQUARE / 4) * 3,
                    left: 0,
                    height: 1,
                    width: SQUARE,
                    background: LINE_FAINT,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: SQUARE / 2,
                    top: 0,
                    width: 1,
                    height: SQUARE,
                    background: LINE,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    top: SQUARE / 2,
                    left: 0,
                    height: 1,
                    width: SQUARE,
                    background: LINE,
                  }}
                />

                {halo && (
                  <div
                    style={{
                      position: "absolute",
                      left: halo.left,
                      top: halo.top,
                      width: 42,
                      height: 42,
                      borderRadius: 21,
                      border: `6px solid ${MARKER}`,
                    }}
                  />
                )}
              </div>

              <Label text={card.yb} align="center" size={label} width={SQUARE} />
            </div>

            <Label text={card.xr} align="left" size={label} width={SIDE} />
          </div>
        ) : (
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
            Where would you sit?
          </div>
        )}
      </div>
    ),
    shareOgSize,
  );
}
