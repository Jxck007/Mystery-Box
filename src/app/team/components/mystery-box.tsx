"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type MysteryBoxProps = {
  disabled?: boolean;
  isClicked?: boolean;
  videoPreviewSrc?: string;
  isPlaying?: boolean;
  gameTitle?: string;
  onOpen: () => void;
  onEnded?: () => void;
};

export function MysteryBox({ disabled, isClicked, videoPreviewSrc, isPlaying, gameTitle, onOpen, onEnded }: MysteryBoxProps) {
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const [showTitleOverlay, setShowTitleOverlay] = useState(false);

  useEffect(() => {
    const video = previewRef.current;
    if (!video || !videoPreviewSrc) return;

    if (isPlaying) {
      video.muted = false;
      video.currentTime = 0;
      video.play().catch((err) => {
        console.error("Video play failed", err);
        video.muted = true;
        video.play();
      });
      return;
    }

    const primeFirstFrame = () => {
      if (!isPlaying) {
        try {
          video.currentTime = 0.05;
          video.pause();
        } catch {}
      }
    };

    video.addEventListener("loadeddata", primeFirstFrame);
    if (!isPlaying) {
      video.load();
    }

    return () => {
      video.removeEventListener("loadeddata", primeFirstFrame);
    };
  }, [videoPreviewSrc, isPlaying]);

  return (
    <div className="relative mx-auto flex min-h-[240px] w-full items-center justify-center">
      <motion.div
        className="pointer-events-none absolute h-44 w-44 rounded-full bg-cyan-300/35 blur-3xl"
        animate={{ opacity: disabled ? 0.2 : [0.35, 0.75, 0.35], scale: disabled ? 1 : [1, 1.2, 1] }}
        transition={{ duration: 2.2, repeat: Infinity }}
      />

      <motion.button
        type="button"
        disabled={disabled || isPlaying}
        onClick={onOpen}
        className="group relative overflow-hidden bg-[linear-gradient(180deg,#09253c_0%,#0d3854_40%,#071b2b_100%)]"
        initial={false}
        animate={
          isPlaying 
            ? { width: "100%", maxWidth: "640px", aspectRatio: "16/9", height: "auto", borderRadius: "24px", boxShadow: "0 0 80px rgba(50,210,255,0.4)" } 
            : isClicked 
              ? { width: 176, height: 176, borderRadius: "24px", scale: [1, 1.12, 0.96], rotate: [0, -1, 1, 0], boxShadow: ["0 0 40px rgba(50,210,255,0.28)", "0 0 80px rgba(130,242,255,0.75)", "0 0 40px rgba(50,210,255,0.28)"] } 
              : { width: 176, height: 176, borderRadius: "24px", scale: 1, rotate: 0, boxShadow: "0 0 40px rgba(50,210,255,0.28)" }
        }
        transition={isPlaying ? { duration: 0.6, ease: "anticipate" } : isClicked ? { duration: 0.65, ease: "easeInOut" } : { duration: 0.2 }}
        whileHover={disabled || isPlaying ? undefined : { scale: 1.04 }}
        whileTap={disabled || isPlaying ? undefined : { scale: 0.98 }}
      >
        {videoPreviewSrc && (
          <div className="absolute inset-1 sm:inset-2 overflow-hidden rounded-2xl border border-cyan-200/40">
            <video
              ref={previewRef}
              className={`h-full w-full object-cover transition-opacity duration-500 ${isPlaying ? 'opacity-100' : 'opacity-65 group-hover:opacity-80'}`}
              src={videoPreviewSrc}
              preload={isPlaying ? "auto" : "metadata"}
              playsInline
              onEnded={onEnded}
              onTimeUpdate={() => {
                if (!previewRef.current || !isPlaying) return;
                const { currentTime, duration } = previewRef.current;
                if (duration > 0 && duration - currentTime <= 3.8) {
                  if (!showTitleOverlay) setShowTitleOverlay(true);
                }
              }}
            />
            {!isPlaying && <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05)_0%,rgba(0,0,0,0.55)_100%)] pointer-events-none" />}
            
            {isPlaying && showTitleOverlay && gameTitle && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute inset-0 flex items-center justify-center z-[20] pointer-events-none"
              >
                <div className="bg-[#0a0a0a] text-[#b4ff39] px-6 py-4 rounded-xl max-w-[85%] text-center border border-[rgba(180,255,57,0.4)] shadow-[0_0_20px_rgba(180,255,57,0.3)]">
                    <h1 className="font-headline text-2xl sm:text-4xl md:text-5xl uppercase tracking-tighter font-black" style={{ letterSpacing: "-0.04em" }}>{gameTitle}</h1>
                  </div>
              </motion.div>
            )}
          </div>
        )}
        {!isPlaying && (
          <motion.div
            className="absolute -top-7 left-3 right-3 h-10 rounded-xl border border-cyan-100/60 bg-[linear-gradient(180deg,#1f6b91_0%,#15587d_100%)]"
            animate={isClicked ? { y: [-2, -12, 2], opacity: [1, 1, 0.92] } : { y: 0, opacity: 1 }}
            transition={{ duration: 0.65, ease: "easeInOut" }}
          />
        )}
        {!isPlaying && <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.26),transparent_42%)] pointer-events-none" />}
        {!isPlaying && <p className="relative z-10 font-headline text-sm font-black tracking-[0.24em] text-cyan-100">MYSTERY BOX</p>}
        {!isPlaying && <p className="relative z-10 mt-2 font-mono text-[10px] tracking-[0.2em] text-cyan-100/75">TAP TO UNLOCK</p>}
      </motion.button>
    </div>
  );
}
