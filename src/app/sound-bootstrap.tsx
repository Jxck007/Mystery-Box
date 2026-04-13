"use client";

import { useEffect } from "react";
import { preloadAllSounds, setGlobalVolume } from "@/lib/sound-manager";

export function SoundBootstrap() {
  useEffect(() => {
    setGlobalVolume(0.5);
    preloadAllSounds();
  }, []);

  return null;
}
