"use client";

import { useEffect } from "react";
import { playSound } from "@/lib/sound-manager";

export function SoundBootstrap() {
  useEffect(() => {
    playSound("bootstrap");
  }, []);

  return null;
}
