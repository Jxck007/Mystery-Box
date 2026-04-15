"use client";

import { motion } from "framer-motion";

const rand = (seed: number, min: number, max: number) => {
  const x = Math.sin(seed * 999) * 10000;
  return min + (x - Math.floor(x)) * (max - min);
};

export function TechBackground() {
  const lines = Array.from({ length: 28 }, (_, i) => i);
  const dots = Array.from({ length: 40 }, (_, i) => i);

  return (
    <div className="absolute inset-0 overflow-hidden bg-[radial-gradient(circle_at_20%_8%,rgba(112,200,236,0.22),transparent_38%),radial-gradient(circle_at_82%_16%,rgba(85,179,214,0.14),transparent_36%),linear-gradient(to_bottom,#e6eef5_0%,#dfe8f0_45%,#dbe4ec_100%)]">
      {dots.map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-cyan-300/60"
          style={{
            width: rand(i, 2, 6),
            height: rand(i + 1, 2, 6),
            left: `${rand(i + 2, 0, 100)}%`,
            top: `${rand(i + 3, 0, 100)}%`,
            filter: "blur(1px)",
          }}
          animate={{ opacity: [0.2, 0.9, 0.2], scale: [1, 1.6, 1] }}
          transition={{ duration: rand(i + 4, 2, 5), repeat: Infinity }}
        />
      ))}

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 700" preserveAspectRatio="none">
        <defs>
          <filter id="reveal-glow">
            <feGaussianBlur stdDeviation="1.2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path d="M0 140 L70 250 L70 540 L180 700" stroke="#2f6f8f" strokeWidth="4" fill="none" opacity="0.6" />
        <path d="M1000 140 L930 250 L930 540 L820 700" stroke="#2f6f8f" strokeWidth="4" fill="none" opacity="0.6" />
        <path d="M40 180 L120 290 L120 580 L220 700" stroke="#5aa7c7" strokeWidth="2" fill="none" opacity="0.55" />
        <path d="M960 180 L880 290 L880 580 L780 700" stroke="#5aa7c7" strokeWidth="2" fill="none" opacity="0.55" />

        {lines.map((i) => {
          const x = rand(i, 120, 880);
          const y = rand(i + 1, 60, 620);
          const h = rand(i + 2, 40, 130);
          const v = rand(i + 3, 20, 80);
          const d = `M ${x} ${y} h ${h / 2} v ${v} h ${h / 2}`;
          return (
            <path
              key={i}
              d={d}
              stroke="#7dbcd4"
              strokeWidth="1.6"
              fill="none"
              opacity="0.38"
              filter="url(#reveal-glow)"
            />
          );
        })}

        {dots.map((i) => (
          <circle
            key={`c${i}`}
            cx={rand(i + 20, 80, 920)}
            cy={rand(i + 30, 40, 660)}
            r={rand(i + 40, 1.8, 3.5)}
            fill="#4fb5d8"
            opacity="0.7"
          />
        ))}
      </svg>

      <div className="absolute inset-0 bg-white/30 backdrop-blur-[1px]" />
    </div>
  );
}
