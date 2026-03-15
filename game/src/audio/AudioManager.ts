import Phaser from 'phaser';

const AUDIO_MANAGER_REGISTRY_KEY = '__audioManager';
const AUDIO_MUTED_STORAGE_KEY = 'no-way-down-audio-muted';

const AUDIO_KEYS = {
  shot: 'sfx-shot',
  playerDamage: 'sfx-player-damage',
  zombieDeath: 'sfx-zombie-death',
  uiConfirm: 'ui-confirm',
  uiPause: 'ui-pause',
  ambientLoop: 'ambient-loop',
  ambientZombieDistant: 'ambient-zombie-distant'
} as const;

type ManagedSoundEvent =
  | 'shot'
  | 'playerDamage'
  | 'zombieDeath'
  | 'uiConfirm'
  | 'uiPause'
  | 'ambientZombieDistant';

type PlaybackResult = 'asset' | 'tone' | 'silent' | 'muted';

interface ToneConfig {
  frequency: number;
  durationMs: number;
  type?: OscillatorType;
  volume?: number;
  frequencyEnd?: number;
}

const TONE_PRESETS: Record<ManagedSoundEvent, ToneConfig> = {
  shot: { frequency: 210, frequencyEnd: 140, durationMs: 80, type: 'square', volume: 0.024 },
  playerDamage: { frequency: 180, frequencyEnd: 90, durationMs: 140, type: 'sawtooth', volume: 0.028 },
  zombieDeath: { frequency: 130, frequencyEnd: 70, durationMs: 220, type: 'triangle', volume: 0.032 },
  uiConfirm: { frequency: 660, frequencyEnd: 720, durationMs: 70, type: 'sine', volume: 0.02 },
  uiPause: { frequency: 420, frequencyEnd: 320, durationMs: 110, type: 'sine', volume: 0.02 },
  ambientZombieDistant: { frequency: 98, frequencyEnd: 78, durationMs: 480, type: 'sawtooth', volume: 0.016 }
};

export class AudioManager {
  private readonly game: Phaser.Game;
  private readonly missingAssetWarnings = new Set<string>();
  private ambientOscillator?: OscillatorNode;
  private ambientGain?: GainNode;
  private isAmbientRunning = false;

  constructor(game: Phaser.Game) {
    this.game = game;
    this.loadPersistedMute();
  }

  play(event: ManagedSoundEvent): PlaybackResult {
    if (this.isMuted()) {
      return 'muted';
    }

    const scene = this.getActiveScene();
    if (!scene) {
      return 'silent';
    }

    const key = this.getKeyForEvent(event);
    if (this.hasAudioAsset(scene, key)) {
      scene.sound.play(key, {
        volume: event.startsWith('ui') ? 0.34 : 0.26,
        detune: event === 'shot' ? Phaser.Math.Between(-90, 70) : 0
      });
      return 'asset';
    }

    this.warnMissingAssetOnce(key, `Usando tono sintético para "${event}".`);
    return this.playToneFallback(scene, TONE_PRESETS[event]);
  }

  startAmbientLoop(): void {
    if (this.isMuted()) {
      this.stopAmbientLoop();
      return;
    }

    const scene = this.getActiveScene();
    if (!scene) {
      return;
    }

    if (this.hasAudioAsset(scene, AUDIO_KEYS.ambientLoop)) {
      const existing = scene.sound.get(AUDIO_KEYS.ambientLoop);
      if (!existing || !existing.isPlaying) {
        scene.sound.play(AUDIO_KEYS.ambientLoop, {
          loop: true,
          volume: 0.18
        });
      }
      this.stopAmbientLoop();
      return;
    }

    if (this.isAmbientRunning) {
      return;
    }

    const context = this.getAudioContext(scene);
    if (!context) {
      this.warnMissingAssetOnce(AUDIO_KEYS.ambientLoop, 'Sin AudioContext: loop ambiente en modo silencioso.');
      return;
    }

    this.warnMissingAssetOnce(AUDIO_KEYS.ambientLoop, 'Loop ambiente con fallback sintético.');

    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(68, context.currentTime);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.linearRampToValueAtTime(0.013, context.currentTime + 1.2);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start();
    this.ambientOscillator = oscillator;
    this.ambientGain = gain;
    this.isAmbientRunning = true;
  }

  stopAmbientLoop(): void {
    const scene = this.getActiveScene();
    if (scene) {
      scene.sound.stopByKey(AUDIO_KEYS.ambientLoop);
    }

    if (!this.isAmbientRunning) {
      return;
    }

    const context = this.ambientGain?.context;
    if (context && this.ambientGain) {
      this.ambientGain.gain.cancelScheduledValues(context.currentTime);
      this.ambientGain.gain.setTargetAtTime(0.0001, context.currentTime, 0.15);
    }

    this.ambientOscillator?.stop((this.ambientOscillator.context.currentTime ?? 0) + 0.35);
    this.ambientOscillator?.disconnect();
    this.ambientGain?.disconnect();
    this.ambientOscillator = undefined;
    this.ambientGain = undefined;
    this.isAmbientRunning = false;
  }

  toggleMute(): boolean {
    return this.setMuted(!this.isMuted());
  }

  setMuted(muted: boolean): boolean {
    this.game.sound.mute = muted;
    this.game.registry.set('audioMuted', muted);

    try {
      localStorage.setItem(AUDIO_MUTED_STORAGE_KEY, muted ? '1' : '0');
    } catch {
      // Ignore storage errors in restricted environments.
    }

    if (muted) {
      this.stopAmbientLoop();
    } else {
      this.startAmbientLoop();
    }

    return muted;
  }

  isMuted(): boolean {
    return Boolean(this.game.sound.mute);
  }

  private loadPersistedMute(): void {
    let persistedMuted = false;

    try {
      persistedMuted = localStorage.getItem(AUDIO_MUTED_STORAGE_KEY) === '1';
    } catch {
      persistedMuted = false;
    }

    this.game.sound.mute = persistedMuted;
    this.game.registry.set('audioMuted', persistedMuted);
  }

  private getAudioContext(scene: Phaser.Scene): AudioContext | undefined {
    const manager = scene.sound as Phaser.Sound.WebAudioSoundManager;
    if (!('context' in manager)) {
      return undefined;
    }

    const context = manager.context as AudioContext | undefined;
    if (!context) {
      return undefined;
    }

    if (context.state === 'suspended') {
      void context.resume();
    }

    return context;
  }

  private playToneFallback(scene: Phaser.Scene, tone: ToneConfig): PlaybackResult {
    const context = this.getAudioContext(scene);
    if (!context) {
      return 'silent';
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = tone.type ?? 'sine';
    oscillator.frequency.setValueAtTime(tone.frequency, now);
    if (tone.frequencyEnd !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, tone.frequencyEnd), now + tone.durationMs / 1000);
    }

    const volume = tone.volume ?? 0.02;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.durationMs / 1000);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + tone.durationMs / 1000 + 0.03);

    return 'tone';
  }

  private hasAudioAsset(scene: Phaser.Scene, key: string): boolean {
    return Boolean(scene.cache.audio.has(key) || scene.sound.get(key));
  }

  private getKeyForEvent(event: ManagedSoundEvent): string {
    switch (event) {
      case 'shot':
        return AUDIO_KEYS.shot;
      case 'playerDamage':
        return AUDIO_KEYS.playerDamage;
      case 'zombieDeath':
        return AUDIO_KEYS.zombieDeath;
      case 'uiConfirm':
        return AUDIO_KEYS.uiConfirm;
      case 'uiPause':
        return AUDIO_KEYS.uiPause;
      case 'ambientZombieDistant':
        return AUDIO_KEYS.ambientZombieDistant;
      default: {
        const exhaustiveCheck: never = event;
        throw new Error(`Evento de audio no soportado: ${String(exhaustiveCheck)}`);
      }
    }
  }

  private getActiveScene(): Phaser.Scene | undefined {
    return this.game.scene.getScenes(true)[0];
  }

  private warnMissingAssetOnce(key: string, message: string): void {
    if (this.missingAssetWarnings.has(key)) {
      return;
    }

    this.missingAssetWarnings.add(key);
    console.info(`[AudioManager] Asset "${key}" no disponible. ${message}`);
  }
}

export const getAudioManager = (scene: Phaser.Scene): AudioManager => {
  const existing = scene.game.registry.get(AUDIO_MANAGER_REGISTRY_KEY) as AudioManager | undefined;
  if (existing) {
    return existing;
  }

  const manager = new AudioManager(scene.game);
  scene.game.registry.set(AUDIO_MANAGER_REGISTRY_KEY, manager);
  return manager;
};
