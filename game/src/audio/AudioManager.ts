import Phaser from 'phaser';

const AUDIO_MANAGER_REGISTRY_KEY = '__audioManager';
const AUDIO_MUTED_STORAGE_KEY = 'no-way-down-audio-muted';
const AUDIO_VOLUME_STORAGE_KEY = 'no-way-down-audio-volume';

const AUDIO_KEYS = {
  shot: 'sfx-shot',
  playerDamage: 'sfx-player-damage',
  zombieDeath: 'sfx-zombie-death',
  uiConfirm: 'ui-confirm',
  uiPause: 'ui-pause',
  menuMusic: 'music-menu',
  gameplayAmbient: 'ambient-gameplay',
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
    this.loadPersistedSettings();
  }

  play(event: ManagedSoundEvent): PlaybackResult {
    if (this.isMuted()) {
      return 'muted';
    }

    const scene = this.getPlaybackScene();
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

  playMenuMusic(): void {
    this.playMusicTrack('menuMusic', 0.22);
    this.stopGameplayAmbient();
  }

  stopMenuMusic(): void {
    this.stopMusicTrack('menuMusic');
  }

  startGameplayAmbient(): void {
    this.stopMenuMusic();
    this.playMusicTrack('gameplayAmbient', 0.18);

    if (!this.isMuted()) {
      this.startAmbientFallbackLoop();
    }
  }

  stopGameplayAmbient(): void {
    this.stopMusicTrack('gameplayAmbient');
    this.stopAmbientFallbackLoop();
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
      this.stopAmbientFallbackLoop();
    } else if (this.isGameSceneActive()) {
      this.startGameplayAmbient();
    }

    return muted;
  }

  setVolumePercent(percent: number): number {
    const clamped = Phaser.Math.Clamp(Math.round(percent), 0, 100);
    this.game.sound.volume = clamped / 100;
    this.game.registry.set('audioVolume', clamped);

    try {
      localStorage.setItem(AUDIO_VOLUME_STORAGE_KEY, String(clamped));
    } catch {
      // Ignore storage errors in restricted environments.
    }

    if (clamped === 0 && !this.isMuted()) {
      this.stopAmbientFallbackLoop();
    } else if (!this.isMuted() && this.isGameSceneActive()) {
      this.startGameplayAmbient();
    }

    return clamped;
  }

  adjustVolumePercent(delta: number): number {
    return this.setVolumePercent(this.getVolumePercent() + delta);
  }

  isMuted(): boolean {
    return Boolean(this.game.sound.mute);
  }

  getVolumePercent(): number {
    const volume = Number.isFinite(this.game.sound.volume) ? this.game.sound.volume : 1;
    return Phaser.Math.Clamp(Math.round(volume * 100), 0, 100);
  }

  private loadPersistedSettings(): void {
    let persistedMuted = false;
    let persistedVolume = 100;

    try {
      persistedMuted = localStorage.getItem(AUDIO_MUTED_STORAGE_KEY) === '1';
      const rawVolume = Number(localStorage.getItem(AUDIO_VOLUME_STORAGE_KEY));
      if (Number.isFinite(rawVolume)) {
        persistedVolume = Phaser.Math.Clamp(Math.round(rawVolume), 0, 100);
      }
    } catch {
      persistedMuted = false;
      persistedVolume = 100;
    }

    this.game.sound.mute = persistedMuted;
    this.game.sound.volume = persistedVolume / 100;
    this.game.registry.set('audioMuted', persistedMuted);
    this.game.registry.set('audioVolume', persistedVolume);
  }

  private playMusicTrack(track: 'menuMusic' | 'gameplayAmbient', volume: number): void {
    if (this.isMuted()) {
      return;
    }

    const scene = this.getPlaybackScene();
    if (!scene) {
      return;
    }

    const key = AUDIO_KEYS[track];
    if (!this.hasAudioAsset(scene, key)) {
      this.warnMissingAssetOnce(key, `Track "${track}" sin asset. Se omite reproducción.`);
      return;
    }

    const existing = scene.sound.get(key);
    if (existing && existing.isPlaying) {
      return;
    }

    scene.sound.play(key, { loop: true, volume });
  }

  private stopMusicTrack(track: 'menuMusic' | 'gameplayAmbient'): void {
    const scene = this.getPlaybackScene();
    if (!scene) {
      return;
    }

    scene.sound.stopByKey(AUDIO_KEYS[track]);
  }

  private startAmbientFallbackLoop(): void {
    if (this.isMuted() || this.getVolumePercent() === 0 || this.hasNativeGameplayAmbient()) {
      this.stopAmbientFallbackLoop();
      return;
    }

    if (this.isAmbientRunning) {
      return;
    }

    const scene = this.getPlaybackScene();
    if (!scene) {
      return;
    }

    const context = this.getAudioContext(scene);
    if (!context) {
      this.warnMissingAssetOnce(AUDIO_KEYS.gameplayAmbient, 'Sin AudioContext: ambiente fallback en silencio.');
      return;
    }

    this.warnMissingAssetOnce(AUDIO_KEYS.gameplayAmbient, 'Ambiente gameplay con fallback sintético.');

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

  private stopAmbientFallbackLoop(): void {
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

  private hasNativeGameplayAmbient(): boolean {
    const scene = this.getPlaybackScene();
    return Boolean(scene && this.hasAudioAsset(scene, AUDIO_KEYS.gameplayAmbient));
  }

  private isGameSceneActive(): boolean {
    const scene = this.game.scene.getScene('GameScene');
    return scene?.scene?.isActive() ?? false;
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

  private getPlaybackScene(): Phaser.Scene | undefined {
    const orderedSceneKeys = ['GameScene', 'MainMenuScene', 'UIScene'];
    for (const key of orderedSceneKeys) {
      const scene = this.game.scene.getScene(key);
      if (scene?.scene?.isActive()) {
        return scene;
      }
    }

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
