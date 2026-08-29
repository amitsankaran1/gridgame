"use client";

import { useState, useTransition } from "react";
import { setProfile } from "@/app/actions";
import { PLAYER_COLORS, type PlayerColor } from "@/lib/colors";

/**
 * Initials and a colour, on the same screen as the week's question. The splash
 * already said what the house is arguing about; this is just who you are.
 *
 * None of this needs persisting. `app/page.tsx` already branches on whether you
 * have initials, so having them *is* the record that you have been here — a
 * returning player never sees this again.
 */
export default function Onboarding() {
  const [initials, setInitials] = useState("");
  const [color, setColor] = useState<PlayerColor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const valid = /^[A-Z0-9]{3}$/.test(initials) && color !== null;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || !color) return;
    setError(null);
    startTransition(async () => {
      const result = await setProfile(initials, color);
      if (result.error) setError(result.error);
    });
  }

  return (
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
            <label
              key={option.name}
              className={`swatch${color === option.name ? " is-selected" : ""}`}
              data-color={option.name}
            >
              <input
                className="swatch-input"
                type="radio"
                name="color"
                value={option.name}
                checked={color === option.name}
                onChange={() => setColor(option.name)}
                aria-label={option.label}
              />
            </label>
          ))}
        </div>
      </fieldset>

      {/* The dot you are about to become, at the size it will actually be
          drawn, wearing the halo that marks it as yours out on the board. */}
      {color ? (
        <p className="identity-preview" data-color={color}>
          <span className="identity-preview-dot" />
          <span>
            You&apos;ll show up as{" "}
            <span className="identity-preview-initials">{initials || "ABC"}</span>
          </span>
        </p>
      ) : null}

      <div className="row">
        <button className="button" type="submit" disabled={!valid || pending}>
          {pending ? "Saving…" : "Take me to the board"}
        </button>
      </div>

      {error && <p className="error">{error}</p>}
    </form>
  );
}
