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
  children?: React.ReactNode;
};

export function MysteryBox({ disabled, isClicked, videoPreviewSrc, isPlaying, gameTitle, onOpen, onEnded, children }: MysteryBoxProps) {
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

      <motion.div
        role={disabled || isPlaying ? undefined : "button"}
        tabIndex={disabled || isPlaying ? undefined : 0}
        onClick={disabled || isPlaying ? undefined : onOpen}
        onKeyDown={(e) => {
          if (!disabled && !isPlaying && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onOpen();
          }
        }}
        className="group relative overflow-hidden bg-[linear-gradient(180deg,#09253c_0%,#0d3854_40%,#071b2b_100%)] w-full mx-auto"
        initial={false}
        animate={
          isPlaying 
            ? { width: "100%", maxWidth: "640px", aspectRatio: "16/9", borderRadius: "24px", boxShadow: "0 0 80px rgba(50,210,255,0.4)", cursor: "default" } 
            : isClicked 
              ? { width: 176, height: 176, maxWidth: "176px", aspectRatio: "1/1", borderRadius: "24px", scale: [1, 1.12, 0.96], rotate: [0, -1, 1, 0], boxShadow: ["0 0 40px rgba(50,210,255,0.28)", "0 0 80px rgba(130,242,255,0.75)", "0 0 40px rgba(50,210,255,0.28)"], cursor: "default" } 
              : { width: 176, height: 176, maxWidth: "176px", aspectRatio: "1/1", borderRadius: "24px", scale: 1, rotate: 0, boxShadow: "0 0 40px rgba(50,210,255,0.28)", cursor: "pointer" }
        }
        style={{
          height: isPlaying ? "auto" : undefined,
          margin: "0 auto",
        }}
        transition={isPlaying ? { duration: 0.6, ease: "anticipate" } : isClicked ? { duration: 0.65, ease: "easeInOut" } : { duration: 0.2 }}
        whileHover={disabled || isPlaying ? undefined : { scale: 1.04 }}
        whileTap={disabled || isPlaying ? undefined : { scale: 0.98 }}
      >
        <motion.div animate={{ paddingTop: isPlaying ? "56.25%" : "0%" }} transition={{ duration: 0.6 }} />
        {videoPreviewSrc && (
          <div className="absolute inset-1 sm:inset-2 overflow-hidden rounded-2xl border border-cyan-200/40">
            <video
              ref={previewRef}
              className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${isPlaying ? 'opacity-100' : 'opacity-65 group-hover:opacity-80'}`}
              src={videoPreviewSrc}
              preload={isPlaying ? "auto" : "metadata"}
              playsInline
              onEnded={onEnded}
              onTimeUpdate={() => {
                if (!previewRef.current || !isPlaying) return;
                const { currentTime, duration } = previewRef.current;
                
                // Show title at 3.8s remaining so it overlays perfectly onto the final white card
                if (duration > 0 && duration - currentTime <= 3.8) {
                  if (!showTitleOverlay) {
                    setShowTitleOverlay(true);
                    if (onEnded) onEnded();
                  }
                }
              }}
            />
            {!isPlaying && <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05)_0%,rgba(0,0,0,0.55)_100%)] pointer-events-none" />}
            {isPlaying && showTitleOverlay && gameTitle && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9, filter: "blur(8px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                transition={{ duration: 1.2, ease: "easeOut" }}
                className="absolute inset-0 flex flex-col items-center justify-center z-[20] pointer-events-none"
              >
                  <h1 
                    className="font-headline uppercase font-black text-center w-full" 
                    style={{ 
                      letterSpacing: "0.15em", 
                      color: "#b4f4ff", 
                      textShadow: "0 0 24px rgba(126,231,255,.7), 0 0 45px rgba(126,231,255,.4)", 
                      fontSize: "clamp(2rem, 7vw, 4.5rem)" 
                    }}
                  >
                    {gameTitle}
                  </h1>
              </motion.div>
            )}
            {children}
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
      </motion.div>
    </div>
  );
}
