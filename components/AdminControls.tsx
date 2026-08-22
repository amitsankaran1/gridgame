"use client";

import { useState, useTransition } from "react";
import {
  putGridUp,
  setIdeaStatus,
  signIn,
  signOut,
  takeGridDown,
} from "@/app/admin/actions";

type Kind = "signOut" | "takeDown" | "promote" | "pass" | "requeue";

const LABELS: Record<Kind, string> = {
  signOut: "sign out",
  takeDown: "Take it down",
  promote: "Put it up",
  pass: "pass",
  requeue: "put back in the queue",
};

const STYLES: Record<Kind, string> = {
  signOut: "button link",
  takeDown: "button secondary",
  promote: "button",
  pass: "button link",
  requeue: "button link",
};

/** One button per admin action. Each one calls a Server Function that re-checks
 *  authorisation itself. */
export default function AdminActions({
  kind,
  ideaId,
}: {
  kind: Kind;
  ideaId?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    setError(null);
    startTransition(async () => {
      const result =
        kind === "signOut"
          ? await signOut()
          : kind === "takeDown"
            ? await takeGridDown()
            : kind === "promote"
              ? await putGridUp({ ideaId })
              : await setIdeaStatus(ideaId, kind === "pass" ? "passed" : "pending");
      if (result.error) setError(result.error);
    });
  }

  return (
    <>
      <button className={STYLES[kind]} onClick={run} disabled={pending}>
        {pending ? "…" : LABELS[kind]}
      </button>
      {error && <span className="error">{error}</span>}
    </>
  );
}

export function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await signIn(password);
      setPassword("");
      if (result.error) setError(result.error);
    });
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div>
        <label className="field-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className="input"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
        />
      </div>
      <div className="row">
        <button className="button" type="submit" disabled={pending || !password}>
          Sign in
        </button>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

const EMPTY = { title: "", x_left: "", x_right: "", y_bottom: "", y_top: "" };

export function NewGridForm() {
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const complete = (["x_left", "x_right", "y_bottom", "y_top"] as const).every(
    (key) => form[key].trim().length > 0,
  );

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!complete) return;
    setError(null);
    startTransition(async () => {
      const result = await putGridUp({ ...form, title: form.title || null });
      if (result.error) setError(result.error);
      else setForm(EMPTY);
    });
  }

  const field = (key: keyof typeof EMPTY, placeholder: string, max = 40) => (
    <input
      className="input"
      value={form[key]}
      maxLength={max}
      onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      placeholder={placeholder}
    />
  );

  return (
    <form className="stack" style={{ marginTop: 10 }} onSubmit={submit}>
      {field("title", "Title (optional)", 80)}
      <div className="field-grid">
        {field("x_left", "X, left")}
        {field("x_right", "X, right")}
        {field("y_bottom", "Y, bottom")}
        {field("y_top", "Y, top")}
      </div>
      <div className="row">
        <button className="button" type="submit" disabled={!complete || pending}>
          Put it up
        </button>
        <span className="meta">This archives whatever is up now.</span>
      </div>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
