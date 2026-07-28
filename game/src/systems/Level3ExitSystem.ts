import Phaser from 'phaser';
import { Player } from '../entities/Player';

export interface Level3ExitDoorConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Level3ExitTarget {
  sceneKey: string;
  spawnPoint: {
    x: number;
    y: number;
  };
}

export interface Level3ExitSystemConfig {
  mainDoorZone: Level3ExitDoorConfig;
  nextLevel: Level3ExitTarget;
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
const DEFAULT_TRANSITION_DELAY_MS = 650;

/**
 * Sistema de salida del nivel 3.
 *
 * Condición de salida:
 * - completar todas las zonas de combate
 * - llegar a la puerta principal
 *
 * Acción:
 * - mostrar mensaje de nivel completado
 * - transición al siguiente nivel
 */
export class Level3ExitSystem {
  private readonly scene: Phaser.Scene;
  private readonly players: Player[];
  private readonly config: Required<Level3ExitSystemConfig>;
  private readonly isAllCombatZonesCompleted: () => boolean;
  private readonly onShowMessage: (message: string) => void;
  private readonly onTransitionStart?: (message: string) => void;

  private readonly mainDoorZone: Phaser.GameObjects.Zone;
  private readonly state: RuntimeState = {
    hasShownCompletedMessage: false,
    hasTransitionStarted: false
  };

  constructor(
    scene: Phaser.Scene,
    players: Player[],
    config: Level3ExitSystemConfig,
    isAllCombatZonesCompleted: () => boolean,
    onShowMessage: (message: string) => void,
    onTransitionStart?: (message: string) => void
  ) {
    this.scene = scene;
    this.players = players;
    this.isAllCombatZonesCompleted = isAllCombatZonesCompleted;
    this.onShowMessage = onShowMessage;
    this.onTransitionStart = onTransitionStart;

    this.config = {
      mainDoorZone: config.mainDoorZone,
      nextLevel: config.nextLevel,
      completedMessage: config.completedMessage ?? DEFAULT_COMPLETED_MESSAGE,
      transitionMessage: config.transitionMessage ?? DEFAULT_TRANSITION_MESSAGE,
      transitionDelayMs: config.transitionDelayMs ?? DEFAULT_TRANSITION_DELAY_MS
    };

    this.mainDoorZone = this.scene.add.zone(
      this.config.mainDoorZone.x,
      this.config.mainDoorZone.y,
      this.config.mainDoorZone.width,
      this.config.mainDoorZone.height
    );

    this.scene.physics.add.existing(this.mainDoorZone, true);
    this.bindMainDoorOverlap();
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
    this.mainDoorZone.destroy();
  }

  private bindMainDoorOverlap(): void {
    this.players.forEach((player) => {
      this.scene.physics.add.overlap(player, this.mainDoorZone, () => {
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
      this.scene.scene.start(this.config.nextLevel.sceneKey, {
        respawnPoint: this.config.nextLevel.spawnPoint
      });
    });
  }

  private canCompleteLevel(): boolean {
    return this.isAllCombatZonesCompleted();
  }
}
