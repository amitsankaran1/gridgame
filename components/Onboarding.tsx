"use client";

import { useState, useTransition } from "react";
import { setProfile } from "@/app/actions";
import Splash from "@/components/Splash";
import { PLAYER_COLORS, type PlayerColor } from "@/lib/colors";
import type { Grid } from "@/lib/types";

/**
 * What a brand new player walks through, once ever.
 *
 * Two screens, in this order on purpose: the week's question first (the splash
 * schematic, so a newcomer never sees real dots), identity second. Being asked
 * to name yourself before you know what you have walked into is the sterile
 * version. Seeing that the house is arguing about chill ↔ not chill, and *then*
 * being asked who you are, is the warm one.
 *
 * None of this needs persisting. `app/page.tsx` already branches on whether you
 * have initials, so having them *is* the record that you have been here — a
 * returning player never sees this again.
 */
export default function Onboarding({ grid }: { grid: Grid }) {
  const [step, setStep] = useState<"welcome" | "identity">("welcome");
  const [initials, setInitials] = useState("");
  const [color, setColor] = useState<PlayerColor>(
    () => PLAYER_COLORS[Math.floor(Math.random() * PLAYER_COLORS.length)].name,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const valid = /^[A-Z0-9]{3}$/.test(initials);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setError(null);
    startTransition(async () => {
      const result = await setProfile(initials, color);
      if (result.error) setError(result.error);
    });
  }

  if (step === "welcome") {
    return (
      <div className="stack">
        {/* The splash is schematic on purpose: this page renders for people who
            have not committed, so a real board here would be a hole in the
            reveal gate. The week's labels are the real ones; the dots are not. */}
        <Splash grid={grid} />

        <div className="row">
          <button className="button" onClick={() => setStep("identity")}>
            I&apos;m in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      <div>
        <h1>First, who are you?</h1>
        <p className="meta">
          Three initials and a colour. This is the whole sign-up.
        </p>
      </div>

      <form className="initials-form stack" onSubmit={submit}>
        <div>
          <label className="field-label" htmlFor="initials">
            Your initials
          </label>
          <div className="initials-row">
            <input
              id="initials"
              className="initials-input"
              value={initials}
              onChange={(event) =>
                setInitials(
                  event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3),
                )
              }
              placeholder="ABC"
              inputMode="text"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              maxLength={3}
              aria-describedby="initials-hint"
            />
          </div>
          <p className="hint" id="initials-hint">
            Three letters or numbers — they sit next to your dot for everyone to
            see.
          </p>
        </div>

        <fieldset className="swatches-field">
          <legend className="field-label">Your colour</legend>
          <div className="swatches">
            {PLAYER_COLORS.map((option) => (
              <button
                key={option.name}
                type="button"
                className="swatch"
                data-color={option.name}
                aria-pressed={color === option.name}
                aria-label={option.label}
                onClick={() => setColor(option.name)}
              />
            ))}
          </div>
        </fieldset>

        {/* The dot you are about to become, at the size it will actually be
            drawn, wearing the halo that marks it as yours out on the board. */}
        <p className="identity-preview" data-color={color}>
          <span className="identity-preview-dot" />
          <span>
            You&apos;ll show up as{" "}
            <span className="identity-preview-initials">{initials || "ABC"}</span>
          </span>
        </p>

        <div className="row">
          <button className="button" type="submit" disabled={!valid || pending}>
            {pending ? "Saving…" : "Take me to the board"}
          </button>
          <button
            className="button link"
            type="button"
            onClick={() => setStep("welcome")}
          >
            back
          </button>
        </div>

        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
