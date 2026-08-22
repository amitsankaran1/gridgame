"use client";

import { useState, useTransition } from "react";
import { setInitials } from "@/app/actions";

/**
 * Three initials are the whole identity model. The field stays large and
 * letter-spaced so it reads as three slots — that's an identity mechanic, not an
 * arcade theme.
 *
 * This is also where a player row first gets minted: the action calls
 * getOrCreatePlayer, so nobody exists in the database until they act.
 */
export default function InitialsEntry({
  initial,
  label = "Your initials",
  cta = "Save",
}: {
  initial?: string | null;
  label?: string;
  cta?: string;
}) {
  const [value, setValue] = useState(initial ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const valid = /^[A-Z0-9]{3}$/.test(value);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setError(null);
    startTransition(async () => {
      const result = await setInitials(value);
      if (result.error) setError(result.error);
    });
  }

  return (
    <form className="initials-form" onSubmit={submit}>
      <label className="field-label" htmlFor="initials">
        {label}
      </label>
      <div className="initials-row">
        <input
          id="initials"
          className="initials-input"
          value={value}
          onChange={(event) =>
            setValue(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3))
          }
          placeholder="ABC"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={3}
          aria-describedby="initials-hint"
        />
        <button className="button" type="submit" disabled={!valid || pending}>
          {pending ? "Saving…" : cta}
        </button>
      </div>
      <p className="hint" id="initials-hint">
        Three letters or numbers. Everyone sees these next to your dot.
      </p>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
