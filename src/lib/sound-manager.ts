const SOUND_FILES = {
  BoxOpen: "/music/BoxOpen.mp3",
  Correct: "/music/Correct.mp3",
  Wrong: "/music/Wrong.mp3",
  Start: "/music/Start.mp3",
  EndGame: "/music/EndGame.mp3",
  Gotin: "/music/Gotin.mp3",
  LeaderBoard: "/music/LeaderBoard.mp3",
} as const;

export type SoundName = keyof typeof SOUND_FILES;

type PlayOptions = {
  waitForEnd?: boolean;
  bypassCooldown?: boolean;
};

class SoundManager {
  private readonly sounds = new Map<SoundName, HTMLAudioElement>();
  private readonly inFlight = new Map<SoundName, Promise<void>>();
  private readonly finishResolvers = new Map<SoundName, () => void>();
  private readonly endHandlers = new Map<SoundName, () => void>();
  private readonly errorHandlers = new Map<SoundName, () => void>();
  private readonly lastTriggeredAt = new Map<SoundName, number>();
  private readonly startedAt = new Map<SoundName, number>();
  private backgroundMusic: HTMLAudioElement | null = null;

  private cooldownMs = 200;
  private maxConcurrent = 2;
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

  playSound(name: SoundName, options: PlayOptions = {}) {
    if (typeof window === "undefined") return Promise.resolve();

    const now = Date.now();
    const last = this.lastTriggeredAt.get(name) ?? 0;
    if (!options.bypassCooldown && now - last < this.cooldownMs) {
      return this.inFlight.get(name) ?? Promise.resolve();
    }

    this.lastTriggeredAt.set(name, now);
    this.trimOverlap(name);

    const audio = this.getAudio(name);
    this.resolveInFlight(name);
    this.startedAt.set(name, now);
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

    return options.waitForEnd ? finished : started;
  }

  stopSound(name: SoundName) {
    const audio = this.sounds.get(name);
    if (!audio) return;
    this.resolveInFlight(name);
    audio.pause();
    audio.currentTime = 0;
  }

  stopAllSounds() {
    (Object.keys(SOUND_FILES) as SoundName[]).forEach((name) => this.stopSound(name));
    this.stopBackgroundMusic();
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

  private trimOverlap(incoming: SoundName) {
    const currentlyPlaying = (Object.keys(SOUND_FILES) as SoundName[]).filter((name) => {
      const audio = this.sounds.get(name);
      if (!audio) return false;
      return !audio.paused && !audio.ended;
    });

    if (currentlyPlaying.length < this.maxConcurrent) return;

    const incomingPriority = this.priority(incoming);
    const candidate = currentlyPlaying
      .map((name) => ({
        name,
        priority: this.priority(name),
        startedAt: this.startedAt.get(name) ?? 0,
      }))
      .sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.startedAt - b.startedAt;
      })[0];

    if (!candidate) return;
    if (candidate.priority > incomingPriority) return;
    this.stopSound(candidate.name);
  }

  private priority(name: SoundName) {
    if (name === "EndGame" || name === "Start") return 3;
    if (name === "Correct" || name === "Wrong") return 2;
    return 1;
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

    this.inFlight.delete(name);
  }
}

export const soundManager = new SoundManager();

export const preloadAllSounds = () => soundManager.preloadAll();
export const playSound = (name: SoundName, options?: PlayOptions) => soundManager.playSound(name, options);
export const stopSound = (name: SoundName) => soundManager.stopSound(name);
export const stopAllSounds = () => soundManager.stopAllSounds();
export const setGlobalVolume = (volume: number) => soundManager.setVolume(volume);
export const toggleMute = () => soundManager.toggleMute();
export const startBackgroundMusic = (src?: string, loop?: boolean) => soundManager.startBackgroundMusic(src, loop);
export const stopBackgroundMusic = () => soundManager.stopBackgroundMusic();
