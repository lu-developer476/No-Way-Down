import Phaser from 'phaser';

const AUDIO_MANAGER_REGISTRY_KEY = '__audioManager';
const AUDIO_MUTED_STORAGE_KEY = 'no-way-down-audio-muted';
const AUDIO_VOLUME_STORAGE_KEY = 'no-way-down-audio-volume';
const AUDIO_TYPE_MUTE_STORAGE_KEY = 'no-way-down-audio-type-muted';

const AUDIO_KEYS = {
  shot: 'sfx-shot',
  reload: 'sfx-reload',
  melee: 'sfx-melee',
  footsteps: 'sfx-footsteps',
  zombieGroan: 'sfx-zombie-groan',
  playerDamage: 'sfx-player-damage',
  zombieDeath: 'sfx-zombie-death',
  uiConfirm: 'ui-confirm',
  uiPause: 'ui-pause',
  menuMusic: 'music-menu',
  gameplayAmbient: 'ambient-gameplay',
  cinematicMusic: 'music-cinematic',
  ambientZombieDistant: 'ambient-zombie-distant'
} as const;

type ManagedSoundEvent =
  | 'shot'
  | 'reload'
  | 'melee'
  | 'footsteps'
  | 'zombieGroan'
  | 'playerDamage'
  | 'zombieDeath'
  | 'uiConfirm'
  | 'uiPause'
  | 'ambientZombieDistant';

export type ManagedAudioType =
  | 'gunshots'
  | 'reload'
  | 'melee'
  | 'zombie'
  | 'ambient'
  | 'footsteps'
  | 'cinematicMusic'
  | 'ui';

interface PlayOptions {
  x?: number;
  y?: number;
  volume?: number;
  detune?: number;
}

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
  reload: { frequency: 320, frequencyEnd: 190, durationMs: 160, type: 'triangle', volume: 0.019 },
  melee: { frequency: 290, frequencyEnd: 110, durationMs: 110, type: 'sawtooth', volume: 0.02 },
  footsteps: { frequency: 180, frequencyEnd: 120, durationMs: 60, type: 'square', volume: 0.008 },
  zombieGroan: { frequency: 88, frequencyEnd: 66, durationMs: 300, type: 'triangle', volume: 0.016 },
  playerDamage: { frequency: 180, frequencyEnd: 90, durationMs: 140, type: 'sawtooth', volume: 0.028 },
  zombieDeath: { frequency: 130, frequencyEnd: 70, durationMs: 220, type: 'triangle', volume: 0.032 },
  uiConfirm: { frequency: 660, frequencyEnd: 720, durationMs: 70, type: 'sine', volume: 0.02 },
  uiPause: { frequency: 420, frequencyEnd: 320, durationMs: 110, type: 'sine', volume: 0.02 },
  ambientZombieDistant: { frequency: 98, frequencyEnd: 78, durationMs: 480, type: 'sawtooth', volume: 0.016 }
};

export class AudioManager {
  private readonly game: Phaser.Game;
  private readonly missingAssetWarnings = new Set<string>();
  private readonly poolByKey = new Map<string, Phaser.Sound.BaseSound[]>();
  private readonly mutedTypes = new Set<ManagedAudioType>();
  private listenerPosition = new Phaser.Math.Vector2(0, 0);
  private ambientOscillator?: OscillatorNode;
  private ambientGain?: GainNode;
  private isAmbientRunning = false;

  constructor(game: Phaser.Game) {
    this.game = game;
    this.loadPersistedSettings();
  }

  play(event: ManagedSoundEvent, options: PlayOptions = {}): PlaybackResult {
    if (this.isMuted() || this.isMutedByType(this.getTypeForEvent(event))) {
      return 'muted';
    }

    const scene = this.getPlaybackScene();
    if (!scene) {
      return 'silent';
    }

    const key = this.getKeyForEvent(event);
    if (this.hasAudioAsset(scene, key)) {
      return this.playPooledSound(scene, key, {
        volume: this.getDynamicVolume(event, options),
        detune: options.detune ?? (event === 'shot' ? Phaser.Math.Between(-90, 70) : 0)
      });
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
    if (this.isMutedByType('ambient')) {
      return;
    }

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

  startCinematicMusic(): void {
    if (this.isMutedByType('cinematicMusic')) {
      return;
    }

    this.playMusicTrack('cinematicMusic', 0.25);
  }

  stopCinematicMusic(): void {
    this.stopMusicTrack('cinematicMusic');
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

  setListenerPosition(x: number, y: number): void {
    this.listenerPosition.set(x, y);
  }

  setTypeMuted(type: ManagedAudioType, muted: boolean): void {
    if (muted) {
      this.mutedTypes.add(type);
    } else {
      this.mutedTypes.delete(type);
    }

    if (type === 'ambient' && muted) {
      this.stopGameplayAmbient();
    }
    if (type === 'cinematicMusic' && muted) {
      this.stopCinematicMusic();
    }

    this.persistMutedTypes();
  }

  isMutedByType(type: ManagedAudioType): boolean {
    return this.mutedTypes.has(type);
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

    this.loadPersistedMutedTypes();
  }

  private playMusicTrack(track: 'menuMusic' | 'gameplayAmbient' | 'cinematicMusic', volume: number): void {
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

    const existingPool = this.poolByKey.get(key) ?? [];
    if (existingPool.some((sound) => sound.isPlaying)) {
      return;
    }

    this.playPooledSound(scene, key, { loop: true, volume });
  }

  private stopMusicTrack(track: 'menuMusic' | 'gameplayAmbient' | 'cinematicMusic'): void {
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

  private playPooledSound(scene: Phaser.Scene, key: string, config: Phaser.Types.Sound.SoundConfig): PlaybackResult {
    const pool = this.poolByKey.get(key) ?? [];
    let sound = pool.find((candidate) => !candidate.isPlaying);

    if (!sound) {
      sound = scene.sound.add(key, config);
      pool.push(sound);
      this.poolByKey.set(key, pool);
    }

    sound.play(config);
    return 'asset';
  }

  private getDynamicVolume(event: ManagedSoundEvent, options: PlayOptions): number {
    const base = options.volume ?? (event.startsWith('ui') ? 0.34 : 0.26);
    if (options.x === undefined || options.y === undefined || event.startsWith('ui')) {
      return base;
    }

    const distance = Phaser.Math.Distance.Between(options.x, options.y, this.listenerPosition.x, this.listenerPosition.y);
    const attenuation = Phaser.Math.Clamp(1 - distance / 760, 0.12, 1);
    return base * attenuation;
  }

  private getTypeForEvent(event: ManagedSoundEvent): ManagedAudioType {
    switch (event) {
      case 'shot':
        return 'gunshots';
      case 'reload':
        return 'reload';
      case 'melee':
        return 'melee';
      case 'zombieDeath':
      case 'zombieGroan':
      case 'playerDamage':
        return 'zombie';
      case 'ambientZombieDistant':
        return 'ambient';
      case 'footsteps':
        return 'footsteps';
      case 'uiConfirm':
      case 'uiPause':
        return 'ui';
      default:
        return 'ui';
    }
  }

  private loadPersistedMutedTypes(): void {
    try {
      const serialized = localStorage.getItem(AUDIO_TYPE_MUTE_STORAGE_KEY);
      if (!serialized) {
        return;
      }

      const parsed = JSON.parse(serialized) as ManagedAudioType[];
      parsed.forEach((type) => this.mutedTypes.add(type));
    } catch {
      this.mutedTypes.clear();
    }
  }

  private persistMutedTypes(): void {
    try {
      localStorage.setItem(AUDIO_TYPE_MUTE_STORAGE_KEY, JSON.stringify(Array.from(this.mutedTypes)));
    } catch {
      // Ignore storage errors.
    }
  }

  private hasAudioAsset(scene: Phaser.Scene, key: string): boolean {
    return Boolean(scene.cache.audio.has(key) || scene.sound.get(key));
  }

  private getKeyForEvent(event: ManagedSoundEvent): string {
    switch (event) {
      case 'shot':
        return AUDIO_KEYS.shot;
      case 'reload':
        return AUDIO_KEYS.reload;
      case 'melee':
        return AUDIO_KEYS.melee;
      case 'footsteps':
        return AUDIO_KEYS.footsteps;
      case 'zombieGroan':
        return AUDIO_KEYS.zombieGroan;
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
