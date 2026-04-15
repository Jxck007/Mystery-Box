import { motion } from "framer-motion";

type LockOverlayProps = {
  secondsRemaining: number;
  message: string;
  showHint: boolean;
};

export function SecurityLockOverlay({ secondsRemaining, message, showHint }: LockOverlayProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="security-lock-overlay"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        background: "rgba(4, 8, 17, 0.95)",
        color: "white",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        textAlign: "center",
        pointerEvents: "auto",
        touchAction: "none",
      }}
    >
      <div style={{ maxWidth: 520, width: "100%" }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 76,
            height: 76,
            borderRadius: 24,
            background: "rgba(255, 255, 255, 0.08)",
            margin: "0 auto 1rem",
            fontSize: 36,
          }}
        >
          ⚠️
        </div>
        <h2 style={{ margin: 0, fontSize: "1.6rem", lineHeight: 1.1 }}>
          Suspicious activity detected.
        </h2>
        <p style={{ margin: "1rem 0 0", opacity: 0.85, lineHeight: 1.6 }}>
          Access is temporarily locked for security reasons. Please return in the countdown below.
        </p>
        <div
          style={{
            marginTop: "1.5rem",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 24,
            padding: "1rem 1.25rem",
          }}
        >
          <p style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600 }}>
            {secondsRemaining}s remaining
          </p>
          <p style={{ margin: "0.75rem 0 0", color: "rgba(255,255,255,0.82)" }}>
            {message}
          </p>
          {showHint && (
            <p style={{ margin: "0.75rem 0 0", color: "rgba(255,255,255,0.68)", fontSize: "0.95rem" }}>
              Tip: stay in the app and avoid rapid switching while the round is active.
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
