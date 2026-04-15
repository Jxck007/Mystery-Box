"use client";

import { useEffect, useState } from "react";
import { isSoundEnabled, setSoundEnabled } from "@/lib/sound-manager";

export function SoundToggle() {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isSoundEnabled());
  }, []);

  return (
    <button
      type="button"
      className={`header-toggle ${enabled ? "is-active" : "is-muted"}`}
      onClick={() => {
        const nextValue = !enabled;
        setEnabled(nextValue);
        setSoundEnabled(nextValue);
      }}
      aria-pressed={enabled}
      aria-label={enabled ? "Disable sound" : "Enable sound"}
      title={enabled ? "Disable sound" : "Enable sound"}
    >
      {enabled ? "SOUND ON" : "SOUND OFF"}
    </button>
  );
}
