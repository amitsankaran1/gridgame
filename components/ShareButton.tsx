"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Share the link, once you've earned it by placing yourself.
 *
 * Three tiers, because this is opened on phones from group chats and the top
 * tier is the one that matters: navigator.share gives the real iOS/Android
 * share sheet, so the link lands in iMessage or WhatsApp in one tap. Desktop
 * browsers mostly lack it, so they fall back to the clipboard, and anything
 * that blocks both gets the URL as selectable text rather than a dead button.
 */
export default function ShareButton({
  question,
  primary = false,
}: {
  question: string;
  /** The sheet leads with it; the button row beside "Move my dot" does not. */
  primary?: boolean;
}) {
  // window doesn't exist while this renders on the server, and reading it
  // during render would be a hydration mismatch. The button is useless for the
  // few milliseconds before this lands, so it stays disabled until then.
  const [url, setUrl] = useState("");
  const [note, setNote] = useState<"copied" | "manual" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // origin, not href: the same board every week, with no query string picked
    // up from wherever the sharer happened to arrive from.
    setUrl(`${window.location.origin}/`);
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
    const text = `Where do you sit? ${question}`;
    if (navigator.share) {
      try {
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
      await navigator.clipboard.writeText(url);
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
