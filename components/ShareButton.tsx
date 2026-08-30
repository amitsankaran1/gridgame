"use client";

import { useEffect, useRef, useState } from "react";
import { imLine, sharePath, toSharePlot, type ShareAxes } from "@/lib/share";

/**
 * Share the link, once you've earned it by placing yourself.
 *
 * Three tiers, because this is opened on phones from group chats and the top
 * tier is the one that matters: navigator.share gives the real iOS/Android
 * share sheet, so the link lands in iMessage or WhatsApp in one tap. Desktop
 * browsers mostly lack it, so they fall back to the clipboard, and anything
 * that blocks both gets the URL as selectable text rather than a dead button.
 *
 * A placed share is an I'm-line plus a /s?… URL whose OG card is this plot
 * alone. First-timers never reach this button — the board hides it until you
 * commit — and if they did, it would still send the generic /.
 */
export default function ShareButton({
  axes,
  plot,
  primary = false,
}: {
  axes: ShareAxes;
  /** Plane −1…1. Null means no plot yet: share / , not /s. */
  plot: { x: number; y: number } | null;
  /** The sheet leads with it; the button row beside "Move my dot" does not. */
  primary?: boolean;
}) {
  // window doesn't exist while this renders on the server, and reading it
  // during render would be a hydration mismatch. The button is useless for the
  // few milliseconds before this lands, so it stays disabled until then.
  const [origin, setOrigin] = useState("");
  const [note, setNote] = useState<"copied" | "manual" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const card = plot ? { ...axes, ...toSharePlot(plot.x, plot.y) } : null;
  const path = card ? sharePath(card) : "/";
  const url = origin ? `${origin}${path}` : "";
  const text = card ? imLine(card) : "";

  useEffect(() => {
    setOrigin(window.location.origin);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function flash(next: "copied" | "manual") {
    setNote(next);
    if (timer.current) clearTimeout(timer.current);
    // The manual fallback is the only way left to get the link, so it stays.
    if (next === "copied") timer.current = setTimeout(() => setNote(null), 2500);
  }

  async function share() {
    if (navigator.share) {
      try {
        // Native share: I'm-line in `text`, /s?… in `url`. No dare.
        await navigator.share({ title: "gridgame", text, url });
        return;
      } catch (err) {
        // Dismissing the sheet is a choice, not a failure — don't "helpfully"
        // copy the link behind their back. Anything else is a real failure and
        // falls through to the clipboard.
        if (err instanceof Error && err.name === "AbortError") return;
      }
    }
    try {
      // Clipboard has one string: the I'm-line, then the /s?… URL.
      await navigator.clipboard.writeText(card ? `${text}\n${url}` : url);
      flash("copied");
    } catch {
      flash("manual");
    }
  }

  return (
    <>
      <button
        className={primary ? "button" : "button secondary"}
        onClick={share}
        disabled={!url}
      >
        Share
      </button>

      {/* One region for both outcomes, announced rather than only shown. */}
      <span className="meta" aria-live="polite">
        {note === "copied" && "Link copied."}
      </span>

      {note === "manual" && (
        <input
          className="input share-url"
          value={url}
          readOnly
          onFocus={(event) => event.target.select()}
          aria-label="Link to this grid"
        />
      )}
    </>
  );
}
