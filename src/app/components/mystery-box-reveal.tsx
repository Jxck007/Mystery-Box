"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type RevealPhase = "idle" | "shake" | "burst" | "rise" | "flip" | "done";

type Particle = {
  id: number;
  vx: number;
  vy: number;
  size: number;
  hue: number;
  delay: number;
};

type MysteryBoxRevealProps = {
  title: string;
  subtitle: string;
  className?: string;
  triggerLabel?: string;
  autoStart?: boolean;
  onRevealComplete?: () => void;
  audio?: {
    buildupSrc?: string;
    burstSrc?: string;
    revealSrc?: string;
  };
};

const TOTAL_DURATION_MS = 11_000;

const PHASE_MS = {
  shake: 2_000,
  lidOpen: 4_000,
  burst: 5_000,
  rise: 7_000,
  flip: 9_000,
  done: 10_000,
  complete: TOTAL_DURATION_MS,
} as const;

function buildParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.random() * Math.PI - Math.PI / 2;
    const speed = 130 + Math.random() * 220;
    return {
      id: i,
      vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 120,
      vy: Math.sin(angle) * speed - 120 - Math.random() * 220,
      size: 4 + Math.random() * 9,
      hue: 42 + Math.random() * 24,
      delay: Math.random() * 140,
    };
  });
}

function toParticleStyle(particle: Particle): CSSProperties {
  return {
    "--vx": `${particle.vx.toFixed(1)}px`,
    "--vy": `${particle.vy.toFixed(1)}px`,
    "--size": `${particle.size.toFixed(1)}px`,
    "--hue": `${particle.hue.toFixed(1)}`,
    "--delay": `${particle.delay.toFixed(0)}ms`,
  } as CSSProperties;
}

export default function MysteryBoxRevealAnimation({
  title,
  subtitle,
  className,
  triggerLabel = "Reveal Reward",
  autoStart = false,
  onRevealComplete,
  audio,
}: MysteryBoxRevealProps) {
  const [phase, setPhase] = useState<RevealPhase>("idle");
  const [started, setStarted] = useState(false);
  const [isBursting, setIsBursting] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);

  const timersRef = useRef<number[]>([]);
  const buildupRef = useRef<HTMLAudioElement | null>(null);
  const burstRef = useRef<HTMLAudioElement | null>(null);
  const revealRef = useRef<HTMLAudioElement | null>(null);

  const classes = useMemo(() => {
    return [
      "mb-root",
      className ?? "",
      started ? "is-started" : "",
      `phase-${phase}`,
      isBursting ? "is-bursting" : "",
      isClaimed ? "is-claimed" : "",
    ]
      .filter(Boolean)
      .join(" ");
  }, [className, isBursting, isClaimed, phase, started]);

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current) {
      window.clearTimeout(id);
    }
    timersRef.current = [];
  }, []);

  const resetAudio = useCallback((el: HTMLAudioElement | null) => {
    if (!el) return;
    el.pause();
    el.currentTime = 0;
  }, []);

  const stopAllAudio = useCallback(() => {
    resetAudio(buildupRef.current);
    resetAudio(burstRef.current);
    resetAudio(revealRef.current);
  }, [resetAudio]);

  const playAudio = useCallback(
    async (el: HTMLAudioElement | null, loop = false) => {
      if (!el) return;
      stopAllAudio();
      el.loop = loop;
      el.currentTime = 0;
      try {
        await el.play();
      } catch {
        // Ignore autoplay restrictions while keeping sound state clean.
      }
    },
    [stopAllAudio],
  );

  const schedule = useCallback((delay: number, cb: () => void) => {
    const id = window.setTimeout(cb, delay);
    timersRef.current.push(id);
  }, []);

  const startReveal = useCallback(() => {
    if (started || isClaimed) return;

    clearTimers();
    stopAllAudio();

    setStarted(true);
    setIsClaimed(false);
    setPhase("idle");
    setIsBursting(false);
    setParticles([]);

    void playAudio(buildupRef.current, true);

    schedule(PHASE_MS.shake, () => {
      setPhase("shake");
    });

    schedule(PHASE_MS.lidOpen, () => {
      setPhase("burst");
      resetAudio(buildupRef.current);
    });

    schedule(PHASE_MS.burst, () => {
      setIsBursting(true);
      setParticles(buildParticles(44));
      void playAudio(burstRef.current, false);
    });

    schedule(PHASE_MS.rise, () => {
      setIsBursting(false);
      setPhase("rise");
    });

    schedule(PHASE_MS.flip, () => {
      setPhase("flip");
      void playAudio(revealRef.current, false);
    });

    schedule(PHASE_MS.done, () => {
      setPhase("done");
    });

    schedule(PHASE_MS.complete, () => {
      setIsClaimed(true);
      onRevealComplete?.();
    });
  }, [clearTimers, isClaimed, onRevealComplete, playAudio, resetAudio, schedule, started, stopAllAudio]);

  useEffect(() => {
    buildupRef.current = audio?.buildupSrc ? new Audio(audio.buildupSrc) : null;
    burstRef.current = audio?.burstSrc ? new Audio(audio.burstSrc) : null;
    revealRef.current = audio?.revealSrc ? new Audio(audio.revealSrc) : null;

    return () => {
      stopAllAudio();
    };
  }, [audio?.buildupSrc, audio?.burstSrc, audio?.revealSrc, stopAllAudio]);

  useEffect(() => {
    if (autoStart) startReveal();
  }, [autoStart, startReveal]);

  useEffect(() => {
    return () => {
      clearTimers();
      stopAllAudio();
    };
  }, [clearTimers, stopAllAudio]);

  return (
    <section className={classes}>
      <div className="mb-scene" aria-live="polite">
        <div className="mb-aura" />

        <div className="mb-object">
          <div className="mb-lid" />

          <div className="mb-shell">
            <div className="mb-rim" />

            <div className="mb-inner-clip">
              <div className="mb-light-column" />

              <div className="mb-card-wrap">
                <div className="mb-card">
                  <div className="mb-card-face mb-card-back">
                    <span>MYSTERY</span>
                  </div>
                  <div className="mb-card-face mb-card-front">
                    <h3>{title}</h3>
                    <p>{subtitle}</p>
                    <span className="mb-card-shine" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mb-particles">
            {particles.map((particle) => (
              <span key={particle.id} className="mb-particle" style={toParticleStyle(particle)} />
            ))}
          </div>
        </div>
      </div>

      <button type="button" className="mb-trigger" onClick={startReveal} disabled={started}>
        {started ? "Revealing..." : triggerLabel}
      </button>

      <style jsx>{`
        .mb-root {
          --ease-premium: cubic-bezier(0.22, 1, 0.36, 1);
          display: grid;
          place-items: center;
          gap: 18px;
          width: 100%;
          min-height: 520px;
          perspective: 1400px;
        }

        .mb-scene {
          position: relative;
          width: min(560px, 90vw);
          height: 430px;
          display: grid;
          place-items: end center;
          transform-style: preserve-3d;
        }

        .mb-aura {
          position: absolute;
          bottom: 40px;
          width: 340px;
          height: 110px;
          background: radial-gradient(circle at 50% 50%, rgba(255, 210, 86, 0.46), rgba(255, 176, 64, 0.05) 70%, transparent);
          filter: blur(12px);
          opacity: 0.35;
          transition: opacity 0.45s ease;
          pointer-events: none;
        }

        .mb-object {
          position: relative;
          width: 270px;
          height: 250px;
          transform-style: preserve-3d;
          transform: rotateX(12deg) rotateY(-14deg);
          transition: transform 700ms var(--ease-premium), filter 700ms ease, opacity 700ms ease;
        }

        .mb-shell {
          position: absolute;
          inset: 52px 0 0;
          border-radius: 20px;
          background: linear-gradient(155deg, #f9d77e 0%, #d98b1f 40%, #9b4c07 88%);
          box-shadow:
            inset 0 5px 0 rgba(255, 245, 194, 0.55),
            inset 0 -8px 14px rgba(80, 35, 0, 0.45),
            0 18px 40px rgba(0, 0, 0, 0.42),
            0 0 60px rgba(255, 188, 60, 0.3);
          overflow: visible;
        }

        .mb-shell::before {
          content: "";
          position: absolute;
          inset: 12px;
          border-radius: 14px;
          border: 2px solid rgba(255, 235, 174, 0.45);
          transform: translateZ(2px);
        }

        .mb-rim {
          position: absolute;
          top: -16px;
          left: 14px;
          right: 14px;
          height: 24px;
          border-radius: 14px;
          background: linear-gradient(180deg, #ffd77e, #bb6f17);
          box-shadow: inset 0 2px 0 rgba(255, 255, 255, 0.62);
          z-index: 3;
        }

        .mb-lid {
          position: absolute;
          top: 10px;
          left: 8px;
          width: 254px;
          height: 70px;
          border-radius: 18px;
          background: linear-gradient(160deg, #f7c65d 0%, #c7771a 50%, #89460e 100%);
          box-shadow:
            inset 0 3px 0 rgba(255, 241, 198, 0.64),
            0 14px 20px rgba(0, 0, 0, 0.34),
            0 0 40px rgba(255, 190, 64, 0.35);
          transform-origin: 50% 70%;
          z-index: 6;
        }

        .mb-lid::after {
          content: "";
          position: absolute;
          inset: 8px 16px;
          border-radius: 10px;
          border: 2px solid rgba(255, 233, 178, 0.48);
        }

        .mb-inner-clip {
          position: absolute;
          left: 18px;
          right: 18px;
          top: 14px;
          bottom: 16px;
          border-radius: 12px;
          overflow: hidden;
          background: linear-gradient(180deg, rgba(88, 47, 7, 0.65), rgba(47, 24, 4, 0.9));
          box-shadow: inset 0 2px 8px rgba(0, 0, 0, 0.5);
        }

        .mb-light-column {
          position: absolute;
          left: 50%;
          bottom: 24px;
          width: 26px;
          height: 10px;
          transform: translateX(-50%);
          border-radius: 999px;
          background: radial-gradient(circle, rgba(255, 255, 224, 1) 0%, rgba(255, 226, 118, 0.65) 45%, rgba(255, 201, 66, 0) 100%);
          opacity: 0;
          filter: blur(2px);
        }

        .mb-card-wrap {
          position: absolute;
          left: 50%;
          bottom: -174px;
          width: 154px;
          height: 210px;
          transform: translateX(-50%);
          transform-style: preserve-3d;
          opacity: 0;
        }

        .mb-card {
          position: relative;
          width: 100%;
          height: 100%;
          transform-style: preserve-3d;
          border-radius: 16px;
          box-shadow: 0 20px 36px rgba(0, 0, 0, 0.34);
        }

        .mb-card-face {
          position: absolute;
          inset: 0;
          border-radius: 16px;
          backface-visibility: hidden;
          overflow: hidden;
          display: grid;
          place-items: center;
        }

        .mb-card-back {
          background:
            radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.22), transparent 35%),
            linear-gradient(145deg, #8d4af5 0%, #4430db 52%, #122180 100%);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .mb-card-back span {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.16em;
          color: rgba(246, 237, 255, 0.92);
          text-transform: uppercase;
        }

        .mb-card-front {
          transform: rotateY(180deg);
          background:
            linear-gradient(155deg, #ffeeb5 0%, #f7c75f 46%, #d0851e 100%);
          border: 1px solid rgba(255, 255, 255, 0.38);
          text-align: center;
          padding: 20px 16px;
        }

        .mb-card-front h3 {
          margin: 0;
          font-size: 22px;
          line-height: 1.08;
          color: #4a2400;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .mb-card-front p {
          margin: 10px 0 0;
          font-size: 12px;
          font-weight: 700;
          color: rgba(73, 37, 3, 0.85);
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .mb-card-shine {
          position: absolute;
          inset: -20% auto -20% -50%;
          width: 44%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.76), transparent);
          transform: skewX(-22deg) translateX(-220%);
          opacity: 0;
          pointer-events: none;
        }

        .mb-particles {
          position: absolute;
          inset: 0;
          pointer-events: none;
          z-index: 8;
        }

        .mb-particle {
          position: absolute;
          left: 50%;
          top: 108px;
          width: var(--size);
          height: var(--size);
          border-radius: 999px;
          background: radial-gradient(circle at 30% 30%, #fff7dc, hsl(var(--hue) 95% 62%) 50%, hsl(var(--hue) 96% 52%) 100%);
          opacity: 0;
          filter: drop-shadow(0 0 8px rgba(255, 210, 120, 0.65));
        }

        .mb-trigger {
          border: 0;
          border-radius: 999px;
          padding: 11px 22px;
          font-size: 14px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #1e1406;
          background: linear-gradient(180deg, #ffe082, #e89a2b);
          box-shadow: 0 8px 16px rgba(0, 0, 0, 0.28), inset 0 2px 0 rgba(255, 255, 255, 0.65);
          cursor: pointer;
          transition: transform 200ms ease, opacity 200ms ease;
        }

        .mb-trigger:active {
          transform: translateY(1px);
        }

        .mb-trigger:disabled {
          cursor: not-allowed;
          opacity: 0.76;
        }

        .is-started.phase-idle .mb-light-column {
          animation: idle-build 2s var(--ease-premium) forwards;
        }

        .is-started.phase-shake .mb-object {
          animation: box-shake-ramp 2s ease-in both;
        }

        .is-started.phase-burst .mb-lid,
        .is-started.phase-rise .mb-lid,
        .is-started.phase-flip .mb-lid,
        .is-started.phase-done .mb-lid,
        .is-claimed .mb-lid {
          animation: lid-fly-away 1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }

        .is-bursting .mb-light-column {
          animation: burst-column 2s ease-out forwards;
        }

        .is-bursting .mb-aura {
          opacity: 0.92;
        }

        .is-bursting .mb-particle {
          animation: particle-fly 1.7s var(--ease-premium) var(--delay) forwards;
        }

        .phase-rise .mb-card-wrap {
          opacity: 1;
          animation: card-rise 2s var(--ease-premium) forwards;
        }

        .phase-flip .mb-card-wrap,
        .phase-done .mb-card-wrap,
        .is-claimed .mb-card-wrap {
          opacity: 1;
          transform: translateX(-50%) translateY(-122px);
        }

        .phase-flip .mb-card {
          animation: card-flip 1s var(--ease-premium) forwards;
        }

        .phase-done .mb-card,
        .is-claimed .mb-card {
          transform: rotateY(180deg);
        }

        .phase-done .mb-card-wrap {
          animation: card-float 2s ease-in-out infinite;
        }

        .phase-done .mb-card-shine {
          opacity: 1;
          animation: card-shine 1.2s var(--ease-premium) 120ms forwards;
        }

        .is-claimed .mb-object {
          transform: rotateX(10deg) rotateY(-14deg) translateY(18px);
          filter: saturate(0.82) blur(0.9px);
          opacity: 0.88;
        }

        .is-claimed .mb-aura {
          opacity: 0.18;
        }

        @keyframes idle-build {
          0% {
            opacity: 0.22;
            transform: translateX(-50%) scaleX(0.75);
            filter: blur(2px);
          }
          55% {
            opacity: 0.66;
            transform: translateX(-50%) scaleX(1.18);
            filter: blur(4px);
          }
          100% {
            opacity: 0.86;
            transform: translateX(-50%) scaleX(1.36);
            filter: blur(7px);
          }
        }

        @keyframes box-shake-ramp {
          0% {
            transform: rotateX(12deg) rotateY(-14deg) translateX(0);
          }
          18% {
            transform: rotateX(12deg) rotateY(-14deg) translateX(-1px) rotateZ(-0.4deg);
          }
          36% {
            transform: rotateX(12deg) rotateY(-14deg) translateX(2px) rotateZ(0.7deg);
          }
          58% {
            transform: rotateX(12deg) rotateY(-14deg) translateX(-4px) rotateZ(-1.2deg);
          }
          80% {
            transform: rotateX(12deg) rotateY(-14deg) translateX(6px) rotateZ(1.5deg);
          }
          100% {
            transform: rotateX(12deg) rotateY(-14deg) translateX(0) rotateZ(0);
          }
        }

        @keyframes lid-fly-away {
          0% {
            transform: translate3d(0, 0, 0) rotateX(0) rotateY(0) rotateZ(0);
            opacity: 1;
          }
          30% {
            transform: translate3d(8px, -90px, 44px) rotateX(-28deg) rotateY(16deg) rotateZ(12deg);
            opacity: 1;
          }
          100% {
            transform: translate3d(50px, -140vh, 110px) rotateX(-48deg) rotateY(28deg) rotateZ(30deg);
            opacity: 0;
          }
        }

        @keyframes burst-column {
          0% {
            opacity: 0.45;
            width: 44px;
            height: 80px;
            transform: translateX(-50%) translateY(0);
            filter: blur(8px);
          }
          36% {
            opacity: 1;
            width: 110px;
            height: 280px;
            transform: translateX(-50%) translateY(-36px);
            filter: blur(14px);
          }
          100% {
            opacity: 0;
            width: 160px;
            height: 390px;
            transform: translateX(-50%) translateY(-50px);
            filter: blur(20px);
          }
        }

        @keyframes particle-fly {
          0% {
            opacity: 0;
            transform: translate3d(0, 0, 0) scale(1);
          }
          10% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate3d(var(--vx), var(--vy), 0) scale(0.25);
          }
        }

        @keyframes card-rise {
          0% {
            transform: translateX(-50%) translateY(86px);
          }
          100% {
            transform: translateX(-50%) translateY(-122px);
          }
        }

        @keyframes card-flip {
          0% {
            transform: rotateY(0deg);
          }
          100% {
            transform: rotateY(180deg);
          }
        }

        @keyframes card-float {
          0%,
          100% {
            transform: translateX(-50%) translateY(-122px);
          }
          50% {
            transform: translateX(-50%) translateY(-129px);
          }
        }

        @keyframes card-shine {
          0% {
            transform: skewX(-22deg) translateX(-220%);
            opacity: 0;
          }
          30% {
            opacity: 0.95;
          }
          100% {
            transform: skewX(-22deg) translateX(380%);
            opacity: 0;
          }
        }
      `}</style>
    </section>
  );
}
