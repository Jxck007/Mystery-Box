const SOUND_FILES = {
  Start: "/music/Start.mp3",
  Correct: "/music/Correct.mp3",
  Wrong: "/music/Wrong.mp3",
  Streak: "/music/Streak.mp3",
  Victory: "/music/Victory.mp3",
  Defeat: "/music/Defeat.mp3",
  Start2: "/music/Start2.mp3",
  Correct2: "/music/Correct2.mp3",
  Wrong2: "/music/Wrong2.mp3",
  Victory2: "/music/Victory2.mp3",
  Defeat2: "/music/Defeat2.mp3",
  BoxOpen: "/music/BoxOpen.mp3",
  Gotin: "/music/Gotin.mp3",
  LeaderBoard: "/music/LeaderBoard.mp3",
} as const;

type SoundName = keyof typeof SOUND_FILES;
type SoundPriority = "low" | "medium" | "high";

const EVENT_SOUND_MAP = {
  // Round 1 required mapping
  correct_r1: "Correct",
  wrong_r1: "Wrong",
  streak: "Streak",
  win_r1: "Victory",
  lose_r1: "Defeat",

  // Round 2 required mapping
  start_r2: "Start2",
  correct_r2: "Correct2",
  wrong_r2: "Wrong2",
  win_r2: "Victory2",
  lose_r2: "Defeat2",

  // Shared and utility events used by the app
  start_r1: "Start",
  box_open: "BoxOpen",
  auth_success: "Gotin",
  leaderboard_open: "LeaderBoard",
} as const satisfies Record<string, SoundName>;

export type SoundEventName = keyof typeof EVENT_SOUND_MAP | "bootstrap" | "reset_streak";

const HIGH_EVENTS = new Set<SoundEventName>(["win_r1", "lose_r1", "win_r2", "lose_r2"]);
const MEDIUM_EVENTS = new Set<SoundEventName>(["start_r1", "start_r2", "box_open", "auth_success", "leaderboard_open"]);
const LOW_EVENTS = new Set<SoundEventName>(["correct_r1", "wrong_r1", "correct_r2", "wrong_r2", "streak"]);

class SoundManager {
  private readonly sounds = new Map<SoundName, HTMLAudioElement>();
  private readonly lastTriggeredAt = new Map<SoundName, number>();
  private currentSound: SoundName | null = null;
  private isLocked = false;
  private initialized = false;
  private currentStreak = 0;
  private streakPlayed = false;
  private readonly cooldownMs = 200;

  playSound(eventName: SoundEventName) {
    if (typeof window === "undefined") return;

    this.ensureInitialized();

    if (eventName === "bootstrap") {
      return;
    }

    if (eventName === "reset_streak") {
      this.currentStreak = 0;
      this.streakPlayed = false;
      return;
    }

    if (eventName === "correct_r1") {
      this.currentStreak += 1;
      this.playWithRules(eventName);
      if (this.currentStreak >= 3 && !this.streakPlayed) {
        this.streakPlayed = true;
        window.setTimeout(() => this.playWithRules("streak"), 80);
      }
      return;
    }

    if (eventName === "wrong_r1") {
      this.currentStreak = 0;
      this.streakPlayed = false;
      this.playWithRules(eventName);
      return;
    }

    this.playWithRules(eventName);
  }

  private playWithRules(eventName: Exclude<SoundEventName, "bootstrap" | "reset_streak">) {
    const soundName = EVENT_SOUND_MAP[eventName];
    const audio = this.getAudio(soundName);

    const now = Date.now();
    const last = this.lastTriggeredAt.get(soundName) ?? 0;
    if (now - last < this.cooldownMs) {
      return;
    }

    if (!audio.paused && this.currentSound === soundName) {
      return;
    }

    if (HIGH_EVENTS.has(eventName)) {
      this.stopAllInternal();
      this.isLocked = true;
      this.startPlayback(soundName, audio);
      return;
    }

    if (this.isLocked) {
      return;
    }

    if (MEDIUM_EVENTS.has(eventName)) {
      this.stopLowSounds();
      this.startPlayback(soundName, audio);
      return;
    }

    if (LOW_EVENTS.has(eventName)) {
      if (this.hasAnyActiveSound()) {
        return;
      }
      this.startPlayback(soundName, audio);
    }
  }

  private startPlayback(soundName: SoundName, audio: HTMLAudioElement) {
    this.lastTriggeredAt.set(soundName, Date.now());
    this.currentSound = soundName;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);
  }

  private ensureInitialized() {
    if (this.initialized) return;
    this.initialized = true;
    (Object.keys(SOUND_FILES) as SoundName[]).forEach((name) => {
      const audio = this.getAudio(name);
      audio.preload = "auto";
      audio.volume = 0.5;
      audio.addEventListener("ended", () => {
        if (this.currentSound === name) {
          this.currentSound = null;
        }
        if (this.isLocked && this.isHighSound(name)) {
          this.isLocked = false;
        }
      });
      audio.addEventListener("error", () => {
        if (this.currentSound === name) {
          this.currentSound = null;
        }
        if (this.isLocked && this.isHighSound(name)) {
          this.isLocked = false;
        }
      });
      audio.load();
    });
  }

  private hasAnyActiveSound() {
    for (const audio of this.sounds.values()) {
      if (!audio.paused && !audio.ended) {
        return true;
      }
    }
    return false;
  }

  private stopLowSounds() {
    const lowSoundNames = new Set<SoundName>(["Correct", "Wrong", "Correct2", "Wrong2", "Streak"]);
    for (const [name, audio] of this.sounds.entries()) {
      if (!lowSoundNames.has(name)) continue;
      if (audio.paused) continue;
      audio.pause();
      audio.currentTime = 0;
      if (this.currentSound === name) {
        this.currentSound = null;
      }
    }
  }

  private stopAllInternal() {
    for (const [name, audio] of this.sounds.entries()) {
      if (audio.paused) continue;
      audio.pause();
      audio.currentTime = 0;
      if (this.currentSound === name) {
        this.currentSound = null;
      }
    }
  }

  private isHighSound(name: SoundName) {
    return name === "Victory" || name === "Defeat" || name === "Victory2" || name === "Defeat2";
  }

  private getAudio(name: SoundName) {
    const existing = this.sounds.get(name);
    if (existing) return existing;
    const audio = new Audio(SOUND_FILES[name]);
    this.sounds.set(name, audio);
    return audio;
  }
}

const soundManager = new SoundManager();

export const playSound = (eventName: SoundEventName) => {
  soundManager.playSound(eventName);
};
