import Phaser from 'phaser';
import { Player } from '../entities/Player';

export interface LevelExitZoneConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LevelExitTarget {
  sceneKey: string;
  spawnPoint: {
    x: number;
    y: number;
  };
}

export interface LevelExitSystemConfig {
  requiredCleanupZones: number;
  exitZone: LevelExitZoneConfig;
  transitionTarget: LevelExitTarget;
  completedMessage?: string;
  transitionMessage?: string;
  transitionDelayMs?: number;
}

interface RuntimeState {
  hasShownCompletedMessage: boolean;
  hasTransitionStarted: boolean;
}

const DEFAULT_COMPLETED_MESSAGE = 'Nivel completado';
const DEFAULT_TRANSITION_MESSAGE = 'Avanzando al siguiente nivel...';
const DEFAULT_TRANSITION_DELAY_MS = 500;

/**
 * Sistema de finalización de nivel para el pasillo del subsuelo.
 * Condición de salida:
 * - completar las zonas de limpieza requeridas
 * - llegar a la zona de salida
 */
export class LevelExitSystem {
  private readonly scene: Phaser.Scene;
  private readonly players: Player[];
  private readonly config: Required<LevelExitSystemConfig>;
  private readonly getCompletedCleanupZones: () => number;
  private readonly onShowMessage: (message: string) => void;
  private readonly onTransitionStart?: (message: string) => void;

  private readonly exitZone: Phaser.GameObjects.Zone;
  private readonly state: RuntimeState = {
    hasShownCompletedMessage: false,
    hasTransitionStarted: false
  };

  constructor(
    scene: Phaser.Scene,
    players: Player[],
    config: LevelExitSystemConfig,
    getCompletedCleanupZones: () => number,
    onShowMessage: (message: string) => void,
    onTransitionStart?: (message: string) => void
  ) {
    this.scene = scene;
    this.players = players;
    this.getCompletedCleanupZones = getCompletedCleanupZones;
    this.onShowMessage = onShowMessage;
    this.onTransitionStart = onTransitionStart;

    this.config = {
      requiredCleanupZones: config.requiredCleanupZones,
      exitZone: config.exitZone,
      transitionTarget: config.transitionTarget,
      completedMessage: config.completedMessage ?? DEFAULT_COMPLETED_MESSAGE,
      transitionMessage: config.transitionMessage ?? DEFAULT_TRANSITION_MESSAGE,
      transitionDelayMs: config.transitionDelayMs ?? DEFAULT_TRANSITION_DELAY_MS
    };

    this.exitZone = this.scene.add.zone(
      this.config.exitZone.x,
      this.config.exitZone.y,
      this.config.exitZone.width,
      this.config.exitZone.height
    );

    this.scene.physics.add.existing(this.exitZone, true);
    this.bindExitOverlap();
  }

  update(): void {
    if (this.state.hasShownCompletedMessage || this.state.hasTransitionStarted) {
      return;
    }

    if (this.canCompleteLevel()) {
      this.state.hasShownCompletedMessage = true;
      this.onShowMessage(this.config.completedMessage);
    }
  }

  destroy(): void {
    this.exitZone.destroy();
  }

  private bindExitOverlap(): void {
    this.players.forEach((player) => {
      this.scene.physics.add.overlap(player, this.exitZone, () => {
        this.tryCompleteAndTransition();
      });
    });
  }

  private tryCompleteAndTransition(): void {
    if (this.state.hasTransitionStarted || !this.canCompleteLevel()) {
      return;
    }

    this.state.hasTransitionStarted = true;
    this.onShowMessage(this.config.completedMessage);
    this.onTransitionStart?.(this.config.transitionMessage);

    this.scene.time.delayedCall(this.config.transitionDelayMs, () => {
      this.scene.scene.start(this.config.transitionTarget.sceneKey, {
        respawnPoint: this.config.transitionTarget.spawnPoint
      });
    });
  }

  private canCompleteLevel(): boolean {
    return this.getCompletedCleanupZones() >= this.config.requiredCleanupZones;
  }
}
