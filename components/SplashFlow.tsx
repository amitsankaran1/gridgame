"use client";

import { useEffect, useRef, useState } from "react";
import Onboarding from "@/components/Onboarding";

/**
 * Intro, then who you are. The step lives in memory — Continue advances, Back
 * restores, and neither writes a cookie. Initials still dismiss the splash
 * for good. Both panes stay mounted so going back cannot remount a jump.
 */
export default function SplashFlow() {
  const [screen, setScreen] = useState<"intro" | "profile">("intro");
  const continueRef = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (screen === "profile") {
      document.getElementById("initials")?.focus();
      return;
    }
    continueRef.current?.focus();
  }, [screen]);

  return (
    <div className="splash-stage" data-dir={screen === "profile" ? "forward" : "back"}>
      <div className={`splash-pane${screen === "intro" ? " is-active" : ""}`} inert={screen !== "intro"}>
        <p className="meta">
          This week is a 2-axis grid. Place yourself, then see where everyone else
          landed.
        </p>
        <ol className="splash-steps">
          <li>You get one dot. You can move it later.</li>
          <li>Nobody else shows until you place yours.</li>
        </ol>
        <div className="row">
          <button
            ref={continueRef}
            className="button"
            type="button"
            onClick={() => setScreen("profile")}
          >
            Continue
          </button>
        </div>
      </div>

      <div
        className={`splash-pane${screen === "profile" ? " is-active" : ""}`}
        inert={screen !== "profile"}
      >
        <Onboarding onBack={() => setScreen("intro")} />
      </div>
    </div>
  );
}
