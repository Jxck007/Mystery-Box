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
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center px-4 py-4 text-slate-900 sm:px-6 sm:py-8">
        <motion.div
          className="pointer-events-none absolute left-1/2 top-24 h-20 w-52 -translate-x-1/2 rounded-full bg-cyan-200/80 blur-3xl"
          animate={{ opacity: [0.3, 0.95, 0.3], scale: [0.9, 1.2, 0.9] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />

        <motion.div
          className="w-full overflow-hidden rounded-[2rem] border border-cyan-200/30 bg-[radial-gradient(circle_at_top,_rgba(120,240,255,0.22),_transparent_32%),linear-gradient(180deg,rgba(8,16,28,0.88),rgba(4,9,18,0.98))] shadow-[0_30px_120px_rgba(0,0,0,0.5)]"
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        >
          <div className="grid min-h-[min(84vh,920px)] grid-cols-1 lg:grid-cols-[1.25fr_0.95fr]">
            <div className="flex min-h-[320px] flex-col justify-between gap-6 p-6 sm:p-8 lg:p-10">
              <div className="space-y-3">
                <motion.p
                  className="font-mono text-xs font-semibold tracking-[0.35em] text-cyan-100/85"
                  initial={{ opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  YOU UNLOCKED
                </motion.p>
                <motion.h1
                  className="max-w-2xl font-headline text-4xl font-black uppercase leading-[0.95] text-white sm:text-6xl lg:text-7xl"
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.55, ease: "easeOut", delay: 0.08 }}
                >
                  {gameTitle}
                </motion.h1>
                {gameDescription ? (
                  <motion.p
                    className="max-w-2xl text-sm leading-6 text-slate-200 sm:text-base"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: 0.14 }}
                  >
                    {gameDescription}
                  </motion.p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-3">
                <button type="button" className="button-primary min-w-44" onClick={onBegin} disabled={busy}>
                  {busy ? "INITIALIZING..." : "START GAME"}
                </button>
                <button type="button" className="button-secondary min-w-44" onClick={onClose}>
                  BACK TO DASHBOARD
                </button>
              </div>
            </div>

            <motion.div
              className="border-t border-cyan-200/10 bg-black/20 p-6 sm:p-8 lg:border-l lg:border-t-0 lg:p-10"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, delay: 0.18 }}
            >
              <div className="flex h-full flex-col">
                <h2 className="font-headline text-2xl font-black uppercase text-cyan-100 sm:text-3xl">How to Play</h2>
                <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
                  <ul className="space-y-3 text-sm text-slate-100 sm:text-base">
                    {rules.map((rule, index) => (
                      <motion.li
                        key={rule}
                        className="rounded-2xl border border-cyan-300/15 bg-white/6 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.35, delay: 0.25 + index * 0.06 }}
                      >
                        <span className="mr-2 font-mono text-cyan-200">{index + 1}.</span>
                        <span>{rule}</span>
                      </motion.li>
                    ))}
                  </ul>
                </div>
                <motion.div
                  className="mt-6 rounded-2xl border border-cyan-200/15 bg-slate-950/70 px-4 py-3 text-sm text-slate-100"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.42 }}
                >
                  Battle reward ready. Launch when you are prepared.
                </motion.div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
