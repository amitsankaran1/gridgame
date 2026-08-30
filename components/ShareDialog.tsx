"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import ShareButton from "@/components/ShareButton";
import type { ShareAxes } from "@/lib/share";

/**
 * The prompt that appears the moment you land on the board.
 *
 * A native <dialog> rather than a hand-rolled overlay: showModal() brings the
 * focus trap, the Escape key, the inert background and the ::backdrop with it,
 * and all four are things a div would have to reimplement badly.
 *
 * It fires only on the commit that puts you on the board for the first time —
 * not on every move, which would turn the good moment into a nag.
 */
export default function ShareDialog({
  open,
  onClose,
  axes,
  plot,
}: {
  open: boolean;
  onClose: () => void;
  axes: ShareAxes;
  plot: { x: number; y: number } | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    // showModal() throws if it is already open, and close() fires the close
    // event that calls onClose — so both need guarding against the state they
    // are already in.
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      // Escape and the backdrop both close it without going through React, so
      // the parent has to hear about it from the element itself.
      onClose={onClose}
      onClick={(event) => {
        // A click on the dialog element itself is a click on the backdrop: the
        // contents are in a child, so anything landing here missed them.
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="sheet-body">
        <h2>You&apos;re on the board.</h2>
        <p className="meta">
          Everyone else is visible now. Pass it on and see where they put
          themselves.
        </p>
        <p className="meta">
          Got next week&apos;s grid? <Link href="/ideas">Suggest one</Link>.
        </p>
        <div className="row">
          <ShareButton axes={axes} plot={plot} primary />
          <button className="button link" onClick={onClose}>
            not now
          </button>
        </div>
      </div>
    </dialog>
  );
}
