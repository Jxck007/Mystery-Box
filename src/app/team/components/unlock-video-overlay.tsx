"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type UnlockVideoOverlayProps = {
  open: boolean;
  videoSrc: string;
  onEnded: () => void;
  inline?: boolean;
  showPreview?: boolean;
  onPlaybackStart?: () => void;
  ruleBook?: string[];
};

export function UnlockVideoOverlay({
  open,
  videoSrc,
  onEnded,
  inline = false,
  showPreview = false,
  onPlaybackStart,
  ruleBook,
}: UnlockVideoOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [started, setStarted] = useState(false);
  const onEndedRef = useRef(onEnded);
  const onPlaybackStartRef = useRef(onPlaybackStart);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    onEndedRef.current = onEnded;
    onPlaybackStartRef.current = onPlaybackStart;
  }, [onEnded, onPlaybackStart]);

  useEffect(() => {
    if (!open || !videoRef.current) return;

    const video = videoRef.current;
    let cancelled = false;
    setStarted(false);

    const playVideo = async () => {
      try {
        video.preload = "auto";
        video.load();
        video.currentTime = 0;
        video.muted = false;
        await video.play();
        setStarted(true);
        onPlaybackStartRef.current?.();
      } catch {
        if (cancelled) return;
        try {
          video.muted = true;
          await video.play();
          setStarted(true);
          onPlaybackStartRef.current?.();
        } catch {
          onEndedRef.current();
        }
      }
    };

    void playVideo();

    return () => {
      cancelled = true;
      video.pause();
    };
  }, [open, videoSrc]);

  useEffect(() => {
    if (!showPreview || open || !videoRef.current) return;

    const video = videoRef.current;
    const primeFirstFrame = () => {
      try {
        video.currentTime = 0.05;
        video.pause();
      } catch {
        // Keep default first frame if seeking is unavailable.
      }
    };

    video.addEventListener("loadeddata", primeFirstFrame);
    video.load();
    return () => {
      video.removeEventListener("loadeddata", primeFirstFrame);
    };
  }, [showPreview, open]);

  if (inline) {
    if (!open && !showPreview) {
      return null;
    }

    return (
      <motion.div
        className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-white/20 bg-black shadow-2xl"
        initial={{ opacity: 0.7, scale: 0.94 }}
        animate={{ opacity: 1, scale: open ? 1 : 0.97 }}
        transition={{ duration: 0.32, ease: "easeOut" }}
      >
        <div className="aspect-video w-full">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            src={videoSrc}
            playsInline
            autoPlay={open}
            preload={open ? "auto" : "metadata"}
            controls={true}
            muted
            disablePictureInPicture
            controlsList="nodownload nofullscreen"
            onEnded={onEnded}
            onError={onEnded}
          />
        </div>
        {!started && open && (
          <div className="absolute inset-0 bg-black/70 p-4 sm:p-6">
            {Array.isArray(ruleBook) && ruleBook.length > 0 ? (
              <div className="h-full rounded-xl border border-cyan-500/35 bg-slate-950/70 p-4 sm:p-6 overflow-auto">
                <p className="label text-cyan-200">MISSION RULE BOOK</p>
                <ul className="mt-3 space-y-2 text-sm text-slate-200">
                  {ruleBook.map((rule, index) => (
                    <li key={rule}>
                      <span className="mr-2 font-mono text-cyan-300">{index + 1}.</span>
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center">
                <span className="font-mono text-xs uppercase tracking-[0.2em] text-white/80">Loading video...</span>
              </div>
            )}
          </div>
        )}
      </motion.div>
    );
  }

  const overlayContent = (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[99999] flex items-center justify-center p-0 m-0"
          style={{ backgroundColor: "rgba(0,0,0,0.95)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8 }}
        >
          <div className="relative w-[90vw] max-w-[1200px] aspect-video max-h-[85vh] rounded-xl overflow-hidden bg-black shadow-[0_0_50px_rgba(0,0,0,0.5)]">      
            <video
              ref={videoRef}
              className="w-full h-full object-contain pointer-events-none"        
              src={videoSrc}
              playsInline
              autoPlay
              preload="auto"
              controls={false}
              muted={false}
              onEnded={onEnded}
              onError={(e) => {
                console.error("Video play error:", e);
                // Instead of instantly closing on error, give the user a moment or let them interact if they want
                // or fall back.
              }}
            />
            {!started && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-black/80 z-[10]">
                <span className="font-mono text-sm uppercase tracking-[0.2em] text-white">Loading video...</span>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  if (!mounted) return null;
  return overlayContent;
}
