export type SecurityState = {
  cheated: boolean;
  lockActive: boolean;
  lockEndTime: number | null;
};

const LOCK_DURATION_MS = 30_000;
const STORAGE_KEYS = {
  cheated: "cheated",
  lockActive: "lock_active",
  lockEndTime: "lock_end_time",
};

const isBrowser = typeof window !== "undefined";

function parseNumber(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export const SecurityManager = {
  getState(): SecurityState {
    if (!isBrowser) {
      return { cheated: false, lockActive: false, lockEndTime: null };
    }

    const cheated = window.sessionStorage.getItem(STORAGE_KEYS.cheated) === "1";
    const lockActive = window.sessionStorage.getItem(STORAGE_KEYS.lockActive) === "1";
    const lockEndTime = parseNumber(window.sessionStorage.getItem(STORAGE_KEYS.lockEndTime));

    if (lockActive && lockEndTime !== null && Date.now() >= lockEndTime) {
      this.clearLock();
      return { cheated, lockActive: false, lockEndTime: null };
    }

    return { cheated, lockActive, lockEndTime };
  },

  markCheated(): void {
    if (!isBrowser) return;
    window.sessionStorage.setItem(STORAGE_KEYS.cheated, "1");
  },

  createLock(reason?: string): void {
    if (!isBrowser) return;
    const lockEndTime = Date.now() + LOCK_DURATION_MS;
    window.sessionStorage.setItem(STORAGE_KEYS.lockActive, "1");
    window.sessionStorage.setItem(STORAGE_KEYS.lockEndTime, String(lockEndTime));
    this.markCheated();
    if (reason) {
      console.warn("SecurityManager: lock triggered", reason);
    }
  },

  clearLock(): void {
    if (!isBrowser) return;
    window.sessionStorage.removeItem(STORAGE_KEYS.lockActive);
    window.sessionStorage.removeItem(STORAGE_KEYS.lockEndTime);
  },

  getRemainingSeconds(): number {
    if (!isBrowser) return 0;
    const lockEndTime = parseNumber(window.sessionStorage.getItem(STORAGE_KEYS.lockEndTime));
    if (!lockEndTime) return 0;
    return Math.max(0, Math.ceil((lockEndTime - Date.now()) / 1000));
  },

  initializeProtection(): () => void {
    if (!isBrowser) return () => undefined;

    const denyAction = (event: Event) => {
      event.preventDefault();
    };

    document.documentElement.style.userSelect = "none";
    document.documentElement.style.webkitUserSelect = "none";
    document.documentElement.style.setProperty("-webkit-touch-callout", "none");

    window.addEventListener("copy", denyAction, { passive: false });
    window.addEventListener("cut", denyAction, { passive: false });
    window.addEventListener("contextmenu", denyAction, { passive: false });
    window.addEventListener("dragstart", denyAction, { passive: false });
    document.addEventListener("selectstart", denyAction, { passive: false });

    return () => {
      window.removeEventListener("copy", denyAction);
      window.removeEventListener("cut", denyAction);
      window.removeEventListener("contextmenu", denyAction);
      window.removeEventListener("dragstart", denyAction);
      document.removeEventListener("selectstart", denyAction);
      document.documentElement.style.userSelect = "";
      document.documentElement.style.webkitUserSelect = "";
      document.documentElement.style.removeProperty("-webkit-touch-callout");
    };
  },
};
