"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

type UnlockVideoOverlayProps = {
  open: boolean;
  videoSrc: string;
  onEnded: () => void;
};

export function UnlockVideoOverlay({ open, videoSrc, onEnded }: UnlockVideoOverlayProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!open || !videoRef.current) return;

    const video = videoRef.current;
    let cancelled = false;

    const playVideo = async () => {
      try {
        video.currentTime = 0;
        video.muted = false;
        await video.play();
      } catch {
        if (cancelled) return;
        try {
          video.muted = true;
          await video.play();
        } catch {
          onEnded();
        }
      }
    };

    void playVideo();

    return () => {
      cancelled = true;
      video.pause();
    };
  }, [open, onEnded]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[200] bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
        >
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            src={videoSrc}
            playsInline
            autoPlay
            preload="auto"
            controls={false}
            disablePictureInPicture
            controlsList="nodownload nofullscreen noremoteplayback"
            onEnded={onEnded}
            onError={onEnded}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
