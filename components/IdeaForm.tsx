"use client";

import { useState, useTransition } from "react";
import { submitIdea } from "@/app/actions";

const EMPTY = { x_left: "", x_right: "", y_bottom: "", y_top: "" };

export default function IdeaForm() {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const complete = Object.values(form).every((value) => value.trim().length > 0);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!complete) return;
    setError(null);
    startTransition(async () => {
      const result = await submitIdea(form);
      if (result.error) setError(result.error);
      else setForm(EMPTY);
    });
  }

  const field = (key: keyof typeof EMPTY, label: string, placeholder: string) => (
    <div>
      <label className="field-label" htmlFor={key}>
        {label}
      </label>
      <input
        id={key}
        className="input"
        value={form[key]}
        maxLength={40}
        onChange={(event) => setForm({ ...form, [key]: event.target.value })}
        placeholder={placeholder}
      />
    </div>
  );

  return (
    <form className="stack" onSubmit={submit}>
      <div className="field-grid">
        {field("x_left", "X, left", "chill")}
        {field("x_right", "X, right", "not chill")}
        {field("y_bottom", "Y, bottom", "low maintenance")}
        {field("y_top", "Y, top", "high maintenance")}
      </div>
      <div className="row">
        <button className="button" type="submit" disabled={!complete || pending}>
          {pending ? "Sending…" : "Submit idea"}
        </button>
        <span className="meta">Five waiting at a time.</span>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
