import Phaser from 'phaser';

export interface ExteriorApproachMessageCue {
  progress: number;
  text: string;
}

export interface ExteriorApproachNextLevelTarget {
  sceneKey: string;
  spawnPoint: {
    x: number;
    y: number;
  };
}

export interface ExteriorApproachSystemConfig {
  levelWidth: number;
  approachStartX: number;
  corridorTopY: number;
  corridorBottomY: number;
  exitZone: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  nextLevel: ExteriorApproachNextLevelTarget;
  messageCues?: ExteriorApproachMessageCue[];
  transitionMessage?: string;
  transitionDelayMs?: number;
  baseDarknessAlpha?: number;
  minDarknessAlpha?: number;
  exteriorGlowColor?: number;
  exteriorGlowMaxAlpha?: number;
  minProgressForExit?: number;
  onNarrativeMessage?: (message: string) => void;
  onTransitionStart?: (message: string) => void;
  onBackgroundIntensityChange?: (progress: number) => void;
}

const DEFAULT_MESSAGE_CUES: ExteriorApproachMessageCue[] = [
  { progress: 0.2, text: 'Se siente una brisa más fresca entre los pasillos.' },
  { progress: 0.5, text: 'Se escuchan pasos y voces del otro lado.' },
  { progress: 0.8, text: 'La luz natural entra con fuerza. La salida está cerca.' }
];

const DEFAULT_TRANSITION_MESSAGE = 'El equipo alcanza la salida exterior...';
const DEFAULT_TRANSITION_DELAY_MS = 750;

export type ExteriorApproachActor = Phaser.GameObjects.GameObject & {
  x: number;
  body: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | null;
};

export class ExteriorApproachSystem {
  private readonly scene: Phaser.Scene;
  private readonly players: ExteriorApproachActor[];
  private readonly config: Required<Omit<ExteriorApproachSystemConfig,
  'onNarrativeMessage' | 'onTransitionStart' | 'onBackgroundIntensityChange'>>;
  private readonly onNarrativeMessage?: (message: string) => void;
  private readonly onTransitionStart?: (message: string) => void;
  private readonly onBackgroundIntensityChange?: (progress: number) => void;

  private readonly exitZone: Phaser.GameObjects.Zone;
  private readonly darknessOverlay: Phaser.GameObjects.Rectangle;
  private readonly exteriorGlow: Phaser.GameObjects.Rectangle;

  private readonly triggeredCueIndexes = new Set<number>();
  private transitionStarted = false;
  private lastProgress = -1;

  constructor(
    scene: Phaser.Scene,
    players: ExteriorApproachActor[],
    config: ExteriorApproachSystemConfig
  ) {
    this.scene = scene;
    this.players = players;
    this.onNarrativeMessage = config.onNarrativeMessage;
    this.onTransitionStart = config.onTransitionStart;
    this.onBackgroundIntensityChange = config.onBackgroundIntensityChange;

    this.config = {
      levelWidth: config.levelWidth,
      approachStartX: config.approachStartX,
      corridorTopY: config.corridorTopY,
      corridorBottomY: config.corridorBottomY,
      exitZone: config.exitZone,
      nextLevel: config.nextLevel,
      messageCues: (config.messageCues ?? DEFAULT_MESSAGE_CUES)
        .map((cue) => ({ ...cue, progress: Phaser.Math.Clamp(cue.progress, 0, 1) }))
        .sort((a, b) => a.progress - b.progress),
      transitionMessage: config.transitionMessage ?? DEFAULT_TRANSITION_MESSAGE,
      transitionDelayMs: config.transitionDelayMs ?? DEFAULT_TRANSITION_DELAY_MS,
      baseDarknessAlpha: config.baseDarknessAlpha ?? 0.28,
      minDarknessAlpha: config.minDarknessAlpha ?? 0.06,
      exteriorGlowColor: config.exteriorGlowColor ?? 0xfff3c4,
      exteriorGlowMaxAlpha: config.exteriorGlowMaxAlpha ?? 0.45,
      minProgressForExit: config.minProgressForExit ?? 0.72
    };

    const corridorHeight = this.config.corridorBottomY - this.config.corridorTopY;
    const corridorCenterY = this.config.corridorTopY + corridorHeight * 0.5;

    this.darknessOverlay = this.scene.add
      .rectangle(
        this.config.levelWidth * 0.5,
        corridorCenterY,
        this.config.levelWidth,
        corridorHeight,
        0x000000,
        this.config.baseDarknessAlpha
      )
      .setDepth(2.8)
      .setScrollFactor(1, 1);

    this.exteriorGlow = this.scene.add
      .rectangle(
        this.config.exitZone.x,
        corridorCenterY,
        Math.max(220, this.config.exitZone.width * 1.75),
        corridorHeight,
        this.config.exteriorGlowColor,
        0
      )
      .setDepth(2.85)
      .setScrollFactor(1, 1);

    this.exitZone = this.scene.add.zone(
      this.config.exitZone.x,
      this.config.exitZone.y,
      this.config.exitZone.width,
      this.config.exitZone.height
    );

    this.scene.physics.add.existing(this.exitZone, true);
    this.bindExitZoneOverlap();
  }

  update(): void {
    if (this.players.length === 0) {
      return;
    }

    const progress = this.getApproachProgress();
    this.applyLighting(progress);
    this.triggerNarrativeCues(progress);

    if (Math.abs(progress - this.lastProgress) >= 0.01) {
      this.onBackgroundIntensityChange?.(progress);
      this.lastProgress = progress;
    }
  }

  destroy(): void {
    this.exitZone.destroy();
    this.darknessOverlay.destroy();
    this.exteriorGlow.destroy();
    this.triggeredCueIndexes.clear();
  }

  private bindExitZoneOverlap(): void {
    this.players.forEach((player) => {
      this.scene.physics.add.overlap(player, this.exitZone, () => {
        this.tryTransition();
      });
    });
  }

  private tryTransition(): void {
    if (this.transitionStarted) {
      return;
    }

    const progress = this.getApproachProgress();
    if (progress < this.config.minProgressForExit) {
      return;
    }

    this.transitionStarted = true;
    this.onTransitionStart?.(this.config.transitionMessage);

    this.scene.time.delayedCall(this.config.transitionDelayMs, () => {
      this.scene.scene.start(this.config.nextLevel.sceneKey, {
        respawnPoint: this.config.nextLevel.spawnPoint
      });
    });
  }

  private applyLighting(progress: number): void {
    const alpha = Phaser.Math.Linear(this.config.baseDarknessAlpha, this.config.minDarknessAlpha, progress);
    this.darknessOverlay.setAlpha(alpha);
    this.exteriorGlow.setAlpha(progress * this.config.exteriorGlowMaxAlpha);
  }

  private triggerNarrativeCues(progress: number): void {
    this.config.messageCues.forEach((cue, index) => {
      if (this.triggeredCueIndexes.has(index) || progress < cue.progress) {
        return;
      }

      this.triggeredCueIndexes.add(index);
      this.onNarrativeMessage?.(cue.text);
    });
  }

  private getApproachProgress(): number {
    const leadX = this.players.reduce((max, player) => Math.max(max, player.x), Number.NEGATIVE_INFINITY);
    const raw = (leadX - this.config.approachStartX) / Math.max(1, this.config.levelWidth - this.config.approachStartX);
    return Phaser.Math.Clamp(raw, 0, 1);
  }
}
