"use client";

import { motion } from "framer-motion";

type MysteryBoxProps = {
  disabled?: boolean;
  isClicked?: boolean;
  videoPreviewSrc?: string;
  onOpen: () => void;
};

export function MysteryBox({ disabled, isClicked, videoPreviewSrc, onOpen }: MysteryBoxProps) {
  return (
    <div className="relative mx-auto flex min-h-60 w-full max-w-md items-center justify-center">
      <motion.div
        className="pointer-events-none absolute h-44 w-44 rounded-full bg-cyan-300/35 blur-3xl"
        animate={{ opacity: disabled ? 0.2 : [0.35, 0.75, 0.35], scale: disabled ? 1 : [1, 1.2, 1] }}
        transition={{ duration: 2.2, repeat: Infinity }}
      />

      <motion.button
        type="button"
        disabled={disabled}
        onClick={onOpen}
        className="group relative h-44 w-44 overflow-hidden rounded-3xl border border-cyan-200/70 bg-[linear-gradient(180deg,#09253c_0%,#0d3854_40%,#071b2b_100%)] shadow-[0_0_40px_rgba(50,210,255,0.28)]"
        initial={false}
        animate={isClicked ? { scale: [1, 1.12, 0.96], rotate: [0, -1, 1, 0], boxShadow: ["0 0 40px rgba(50,210,255,0.28)", "0 0 80px rgba(130,242,255,0.75)", "0 0 40px rgba(50,210,255,0.28)"] } : { scale: 1, rotate: 0 }}
        transition={isClicked ? { duration: 0.65, ease: "easeInOut" } : { duration: 0.2 }}
        whileHover={disabled ? undefined : { scale: 1.04 }}
        whileTap={disabled ? undefined : { scale: 0.98 }}
      >
        {videoPreviewSrc && (
          <div className="absolute inset-2 overflow-hidden rounded-2xl border border-cyan-200/40">
            <video
              className="h-full w-full object-cover opacity-65 transition-opacity duration-300 group-hover:opacity-80"
              src={videoPreviewSrc}
              preload="auto"
              muted
              playsInline
              autoPlay
              loop
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.05)_0%,rgba(0,0,0,0.55)_100%)]" />
          </div>
        )}
        <motion.div
          className="absolute -top-7 left-3 right-3 h-10 rounded-xl border border-cyan-100/60 bg-[linear-gradient(180deg,#1f6b91_0%,#15587d_100%)]"
          animate={isClicked ? { y: [-2, -12, 2], opacity: [1, 1, 0.92] } : { y: 0, opacity: 1 }}
          transition={{ duration: 0.65, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,0.26),transparent_42%)]" />
        <p className="relative z-10 font-headline text-sm font-black tracking-[0.24em] text-cyan-100">MYSTERY BOX</p>
        <p className="relative z-10 mt-2 font-mono text-[10px] tracking-[0.2em] text-cyan-100/75">TAP TO UNLOCK</p>
      </motion.button>
    </div>
  );
}
