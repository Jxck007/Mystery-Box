"use client";

import { motion } from "framer-motion";
import { TechBackground } from "./tech-background";

type RewardRevealProps = {
  gameTitle: string;
  gameDescription?: string | null;
  rules: string[];
  onBegin: () => void;
  onClose: () => void;
  busy?: boolean;
};

export function RewardReveal({ gameTitle, gameDescription, rules, onBegin, onClose, busy }: RewardRevealProps) {
  return (
    <section className="fixed inset-0 z-[160] overflow-y-auto">
      <TechBackground />
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-4 py-10 text-slate-900 sm:px-6">
        <motion.div
          className="pointer-events-none absolute left-1/2 top-24 h-20 w-52 -translate-x-1/2 rounded-full bg-cyan-200/80 blur-3xl"
          animate={{ opacity: [0.3, 0.95, 0.3], scale: [0.9, 1.2, 0.9] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />

        <motion.p
          className="text-center font-mono text-xs font-semibold tracking-[0.35em] text-cyan-900/80"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
        >
          YOU UNLOCKED
        </motion.p>

        <motion.h1
          className="mt-3 text-center font-headline text-4xl font-black uppercase leading-none text-slate-900 sm:text-6xl lg:text-7xl"
          initial={{ opacity: 0, scale: 0.86 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.12 }}
        >
          {gameTitle}
        </motion.h1>

        <motion.div
          className="mt-8 w-full rounded-3xl border border-cyan-800/20 bg-white/72 p-5 shadow-[0_20px_90px_rgba(15,60,88,0.25)] backdrop-blur-md sm:p-8"
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.28 }}
        >
          <h2 className="font-headline text-2xl font-black uppercase text-slate-900">How to Play</h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-700 sm:text-base">
            {rules.map((rule, index) => (
              <li key={rule} className="rounded-xl bg-cyan-50/65 px-4 py-3">
                <span className="mr-2 font-mono text-cyan-700">{index + 1}.</span>
                <span>{rule}</span>
              </li>
            ))}
          </ul>
          {gameDescription ? (
            <p className="mt-5 rounded-xl bg-slate-950/90 px-4 py-3 text-sm text-slate-100">
              {gameDescription}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button type="button" className="button-primary min-w-44" onClick={onBegin} disabled={busy}>
              {busy ? "INITIALIZING..." : "START MISSION"}
            </button>
            <button type="button" className="button-secondary min-w-44" onClick={onClose}>
              BACK TO DASHBOARD
            </button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
