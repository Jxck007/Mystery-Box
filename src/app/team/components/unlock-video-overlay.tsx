"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";

type UnlockVideoOverlayProps = {
  open: boolean;
  videoSrc: string;
  onEnded: () => void;
  inline?: boolean;
};

export function UnlockVideoOverlay({
  open,
  videoSrc,
  onEnded,
  inline = false,
}: UnlockVideoOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [ready, setReady] = useState(false);
  const onEndedRef = useRef(onEnded);
  const startOffsetSeconds = 0.35;

  useEffect(() => {
    onEndedRef.current = onEnded;
  }, [onEnded]);

  useEffect(() => {
    if (!open || !videoRef.current) return;

    const video = videoRef.current;
    let cancelled = false;
    setReady(false);

    const beginPlayback = async () => {
      try {
        if (video.duration > startOffsetSeconds) {
          video.currentTime = startOffsetSeconds;
        }
      } catch {
        // Ignore seek failures and continue with default start.
      }

      await video.play();
      if (cancelled) return;
      setReady(true);
    };

    const playVideo = async () => {
      try {
        video.preload = "auto";
        video.load();
        video.muted = true;

        if (video.readyState >= 1) {
          await beginPlayback();
          return;
        }

        const handleLoadedMetadata = () => {
          video.removeEventListener("loadedmetadata", handleLoadedMetadata);
          void beginPlayback();
        };

        video.addEventListener("loadedmetadata", handleLoadedMetadata);
      } catch {
        if (!cancelled) {
          setReady(true);
        }
      }
    };

    void playVideo();

    return () => {
      cancelled = true;
      video.pause();
    };
  }, [open, videoSrc]);

  if (!open) {
    return null;
  }

  return (
    <motion.div
      className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-white/20 bg-black shadow-2xl"
      initial={{ opacity: 0.7, scale: 0.94 }}
      animate={{ opacity: 1, scale: open ? 1 : 0.97 }}
      transition={{ duration: 0.32, ease: "easeOut" }}
      data-inline={inline ? "true" : "false"}
    >
      <div className="aspect-4/3 w-full sm:aspect-video">
        <video
          ref={videoRef}
          className="h-full w-full bg-slate-950 object-contain"
          src={videoSrc}
          playsInline
          autoPlay={open}
          preload={open ? "auto" : "metadata"}
          muted
          controls={false}
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
          onEnded={() => onEndedRef.current()}
          onCanPlay={() => setReady(true)}
          onError={() => setReady(true)}
        />
      </div>

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/65">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-white/80">Loading video...</span>
        </div>
      )}
    </motion.div>
  );
}
