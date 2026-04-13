const SOUND_FILES = {
  BoxOpen: "/music/BoxOpen.mp3",
  Correct: "/music/Correct.mp3",
  Correct2: "/music/Correct2.mp3",
  Wrong: "/music/Wrong.mp3",
  Wrong2: "/music/Wrong2.mp3",
  Start: "/music/Start.mp3",
  Start2: "/music/Start2.mp3",
  Streak: "/music/Streak.mp3",
  EndGame: "/music/EndGame.mp3",
  Victory: "/music/Victory.mp3",
  Defeat: "/music/Defeat.mp3",
  Victory2: "/music/Victory2.mp3",
  Defeat2: "/music/Defeat2.mp3",
  Gotin: "/music/Gotin.mp3",
  LeaderBoard: "/music/LeaderBoard.mp3",
} as const;

export type SoundName = keyof typeof SOUND_FILES;

type SoundPriority = "low" | "medium" | "high";

type PlayOptions = {
  priority?: SoundPriority;
  interrupt?: boolean;
  waitForEnd?: boolean;
  bypassCooldown?: boolean;
};

const HIGH_PRIORITY_SOUNDS = new Set<SoundName>([
  "Victory",
  "Defeat",
  "Victory2",
  "Defeat2",
  "EndGame",
]);

const MEDIUM_PRIORITY_SOUNDS = new Set<SoundName>([
  "BoxOpen",
  "Start",
  "Start2",
  "LeaderBoard",
]);

const LOW_PRIORITY_SOUNDS = new Set<SoundName>([
  "Correct",
  "Correct2",
  "Wrong",
  "Wrong2",
  "Streak",
]);

const PRIORITY_RANK: Record<SoundPriority, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

class SoundManager {
  private readonly sounds = new Map<SoundName, HTMLAudioElement>();
  private readonly inFlight = new Map<SoundName, Promise<void>>();
  private readonly finishResolvers = new Map<SoundName, () => void>();
  private readonly endHandlers = new Map<SoundName, () => void>();
  private readonly errorHandlers = new Map<SoundName, () => void>();
  private readonly lastTriggeredAt = new Map<SoundName, number>();
  private backgroundMusic: HTMLAudioElement | null = null;
  private currentSound: SoundName | null = null;
  private currentPriority: SoundPriority | null = null;
  private highPriorityLock = false;
  private currentStreak = 0;
  private streakPlayed = false;

  private cooldownMs = 200;
  private isMuted = false;
  private baseVolume = 0.5;

  preloadAll() {
    if (typeof window === "undefined") return;
    (Object.keys(SOUND_FILES) as SoundName[]).forEach((name) => {
      const audio = this.getAudio(name);
      audio.load();
    });
  }

  setVolume(volume: number) {
    this.baseVolume = Math.max(0, Math.min(1, volume));
    this.syncVolumes();
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
    this.syncVolumes();
  }

  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  play(name: SoundName, options: PlayOptions = {}) {
    if (typeof window === "undefined") return Promise.resolve();

    const requestedPriority = options.priority ?? this.defaultPriority(name);
    const interrupt = options.interrupt ?? false;
    const incomingRank = PRIORITY_RANK[requestedPriority];
    const active = this.currentSound;
    const activePriority = this.currentPriority;
    const activeRank = activePriority ? PRIORITY_RANK[activePriority] : 0;

    const now = Date.now();
    const last = this.lastTriggeredAt.get(name) ?? 0;
    if (!options.bypassCooldown && now - last < this.cooldownMs) {
      return this.inFlight.get(name) ?? Promise.resolve();
    }

    if (this.highPriorityLock && active && active !== name) {
      return Promise.resolve();
    }

    if (active) {
      const activeAudio = this.sounds.get(active);
      const activePlaying = this.isPlaying(activeAudio);

      if (active === name && activePlaying) {
        this.lastTriggeredAt.set(name, now);
        if (!interrupt && requestedPriority !== "high") {
          return this.inFlight.get(name) ?? Promise.resolve();
        }
        return this.startPlayback(name, requestedPriority, options.waitForEnd === true);
      }

      if (!activePlaying) {
        this.currentSound = null;
        this.currentPriority = null;
        this.highPriorityLock = false;
      } else {
        if (requestedPriority === "low") {
          return Promise.resolve();
        }

        if (incomingRank < activeRank) {
          return Promise.resolve();
        }

        if (incomingRank === activeRank && !interrupt) {
          return Promise.resolve();
        }

        if (requestedPriority === "high") {
          this.stopAllExcept(name);
        } else {
          this.stop(active);
        }
      }
    }

    this.lastTriggeredAt.set(name, now);
    return this.startPlayback(name, requestedPriority, options.waitForEnd === true);
  }

  playSound(name: SoundName, options: PlayOptions = {}) {
    return this.play(name, options);
  }

  private startPlayback(name: SoundName, priority: SoundPriority, waitForEnd: boolean) {
    const now = Date.now();

    const audio = this.getAudio(name);
    this.resolveInFlight(name);
    this.currentSound = name;
    this.currentPriority = priority;
    this.highPriorityLock = priority === "high";

    audio.pause();
    audio.currentTime = 0;
    audio.volume = this.effectiveVolume();

    const finished = new Promise<void>((resolve) => {
      this.finishResolvers.set(name, resolve);

      const onEnded = () => this.resolveInFlight(name);
      const onError = () => this.resolveInFlight(name);

      this.endHandlers.set(name, onEnded);
      this.errorHandlers.set(name, onError);
      audio.addEventListener("ended", onEnded, { once: true });
      audio.addEventListener("error", onError, { once: true });
    });

    this.inFlight.set(name, finished);

    const started = audio
      .play()
      .then(() => undefined)
      .catch(() => {
        this.resolveInFlight(name);
      });

    return waitForEnd ? finished : started;
  }

  stop(name: SoundName) {
    const audio = this.sounds.get(name);
    if (!audio) return;
    this.resolveInFlight(name);
    audio.pause();
    audio.currentTime = 0;
    if (this.currentSound === name) {
      this.currentSound = null;
      this.currentPriority = null;
      this.highPriorityLock = false;
    }
  }

  stopAll() {
    (Object.keys(SOUND_FILES) as SoundName[]).forEach((name) => this.stop(name));
    this.stopBackgroundMusic();
    this.currentSound = null;
    this.currentPriority = null;
    this.highPriorityLock = false;
  }

  stopAllSounds() {
    this.stopAll();
  }

  startBackgroundMusic(src = "/music/background.mp3", loop = true) {
    if (typeof window === "undefined") return;
    if (!this.backgroundMusic) {
      this.backgroundMusic = new Audio(src);
      this.backgroundMusic.preload = "auto";
    }
    this.backgroundMusic.src = src;
    this.backgroundMusic.loop = loop;
    this.backgroundMusic.volume = this.effectiveVolume() * 0.6;
    void this.backgroundMusic.play().catch(() => undefined);
  }

  stopBackgroundMusic() {
    if (!this.backgroundMusic) return;
    this.backgroundMusic.pause();
    this.backgroundMusic.currentTime = 0;
  }

  handleRound1Answer(success: boolean) {
    if (success) {
      this.currentStreak += 1;
      void this.play("Correct2", { priority: "low" });
      if (this.currentStreak >= 3 && !this.streakPlayed) {
        this.streakPlayed = true;
        void this.play("Streak", { priority: "low", bypassCooldown: true });
      }
      return;
    }

    this.currentStreak = 0;
    this.streakPlayed = false;
    void this.play("Wrong2", { priority: "low" });
  }

  resetRound1Streak() {
    this.currentStreak = 0;
    this.streakPlayed = false;
  }

  playRound1Result(result: "selected" | "eliminated") {
    const sound: SoundName = result === "selected" ? "Victory" : "Defeat";
    return this.play(sound, { priority: "high", bypassCooldown: true, waitForEnd: true });
  }

  playRound2Start() {
    return this.play("Start2", { priority: "medium", bypassCooldown: true });
  }

  handleRound2Answer(success: boolean) {
    return this.play(success ? "Correct2" : "Wrong2", { priority: "low" });
  }

  playRound2Result(result: "win" | "lose") {
    const sound: SoundName = result === "win" ? "Victory2" : "Defeat2";
    return this.play(sound, { priority: "high", bypassCooldown: true, waitForEnd: true });
  }

  private effectiveVolume() {
    return this.isMuted ? 0 : this.baseVolume;
  }

  private syncVolumes() {
    const nextVolume = this.effectiveVolume();
    this.sounds.forEach((audio) => {
      audio.volume = nextVolume;
    });
    if (this.backgroundMusic) {
      this.backgroundMusic.volume = nextVolume * 0.6;
    }
  }

  private getAudio(name: SoundName) {
    const existing = this.sounds.get(name);
    if (existing) return existing;

    const audio = new Audio(SOUND_FILES[name]);
    audio.preload = "auto";
    audio.volume = this.effectiveVolume();
    this.sounds.set(name, audio);
    return audio;
  }

  private stopAllExcept(nameToKeep: SoundName) {
    (Object.keys(SOUND_FILES) as SoundName[]).forEach((name) => {
      if (name === nameToKeep) return;
      this.stop(name);
    });
  }

  private defaultPriority(name: SoundName): SoundPriority {
    if (HIGH_PRIORITY_SOUNDS.has(name)) return "high";
    if (MEDIUM_PRIORITY_SOUNDS.has(name)) return "medium";
    if (LOW_PRIORITY_SOUNDS.has(name)) return "low";
    return "low";
  }

  private isPlaying(audio: HTMLAudioElement | undefined) {
    if (!audio) return false;
    return !audio.paused && !audio.ended;
  }

  private resolveInFlight(name: SoundName) {
    const audio = this.sounds.get(name);
    const endHandler = this.endHandlers.get(name);
    const errorHandler = this.errorHandlers.get(name);

    if (audio && endHandler) {
      audio.removeEventListener("ended", endHandler);
    }
    if (audio && errorHandler) {
      audio.removeEventListener("error", errorHandler);
    }

    this.endHandlers.delete(name);
    this.errorHandlers.delete(name);

    const resolve = this.finishResolvers.get(name);
    if (resolve) {
      this.finishResolvers.delete(name);
      resolve();
    }

    if (this.currentSound === name) {
      this.currentSound = null;
      this.currentPriority = null;
      this.highPriorityLock = false;
    }

    this.inFlight.delete(name);
  }
}

export const soundManager = new SoundManager();

export const preloadAllSounds = () => soundManager.preloadAll();
export const play = (name: SoundName, options?: PlayOptions) => soundManager.play(name, options);
export const stop = (name: SoundName) => soundManager.stop(name);
export const stopAll = () => soundManager.stopAll();

export const handleRound1Answer = (success: boolean) => soundManager.handleRound1Answer(success);
export const resetRound1Streak = () => soundManager.resetRound1Streak();
export const playRound1Result = (result: "selected" | "eliminated") => soundManager.playRound1Result(result);
export const playRound2Start = () => soundManager.playRound2Start();
export const handleRound2Answer = (success: boolean) => soundManager.handleRound2Answer(success);
export const playRound2Result = (result: "win" | "lose") => soundManager.playRound2Result(result);

// Backward compatibility for existing imports.
export const playSound = (name: SoundName, options?: PlayOptions) => soundManager.play(name, options);
export const stopSound = (name: SoundName) => soundManager.stop(name);
export const stopAllSounds = () => soundManager.stopAll();
export const setGlobalVolume = (volume: number) => soundManager.setVolume(volume);
export const toggleMute = () => soundManager.toggleMute();
export const startBackgroundMusic = (src?: string, loop?: boolean) => soundManager.startBackgroundMusic(src, loop);
export const stopBackgroundMusic = () => soundManager.stopBackgroundMusic();
