import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { visualTheme } from '../scenes/visualTheme';

const INTERACTION_HOLD_DURATION_MS = 450;

export interface StairTransitionTarget {
  sceneKey: string;
  spawnPoint: {
    x: number;
    y: number;
  };
}

export interface StairConfig {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  prompt: string;
  activeLabel: string;
  inactiveLabel?: string;
  target: StairTransitionTarget;
  startsUnlocked?: boolean;
}

interface StairRuntime {
  config: StairConfig;
  triggerZone: Phaser.GameObjects.Zone;
  inactiveVisual: Phaser.GameObjects.Rectangle;
  activeVisual: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  unlocked: boolean;
}

export class StaircaseSystem {
  private readonly scene: Phaser.Scene;
  private readonly players: Player[];
  private readonly interactionKey: Phaser.Input.Keyboard.Key;
  private readonly promptText: Phaser.GameObjects.Text;
  private readonly holdProgressText: Phaser.GameObjects.Text;
  private readonly stairs = new Map<string, StairRuntime>();
  private holdingSinceMs: number | null = null;

  constructor(scene: Phaser.Scene, players: Player[]) {
    this.scene = scene;
    this.players = players;

    const keyboard = this.scene.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is not available in this scene.');
    }

    this.interactionKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    this.promptText = this.scene.add.text(0, 0, '', {
      color: visualTheme.palette.uiAccent,
      fontSize: '16px',
      backgroundColor: '#132018',
      padding: { x: 8, y: 6 }
    }).setOrigin(0.5).setVisible(false);

    this.holdProgressText = this.scene.add.text(0, 0, '', {
      color: '#b4f5ce',
      fontSize: '14px'
    }).setOrigin(0.5).setVisible(false);
  }

  registerStair(config: StairConfig): void {
    const triggerZone = this.scene.add.zone(config.x, config.y, config.width, config.height);
    this.scene.physics.add.existing(triggerZone, true);

    const inactiveVisual = this.scene.add.rectangle(config.x, config.y, config.width, config.height, 0x111827, 0.18)
      .setStrokeStyle(2, 0x64748b, 0.7);

    const activeVisual = this.scene.add.rectangle(config.x, config.y, config.width, config.height, 0x14532d, 0.16)
      .setStrokeStyle(2, 0x86efac, 0.85)
      .setVisible(false);

    const label = this.scene.add.text(
      config.x,
      config.y - Math.max(20, config.height * 0.22),
      config.inactiveLabel ?? 'ESCALERA\nBLOQUEADA',
      {
        color: visualTheme.palette.uiDanger,
        fontSize: '14px',
        align: 'center'
      }
    ).setOrigin(0.5);

    const runtime: StairRuntime = {
      config,
      triggerZone,
      inactiveVisual,
      activeVisual,
      label,
      unlocked: config.startsUnlocked ?? false
    };

    this.stairs.set(config.id, runtime);

    if (runtime.unlocked) {
      this.setRuntimeUnlocked(runtime, true);
    }
  }

  unlock(stairId: string): void {
    const runtime = this.stairs.get(stairId);
    if (!runtime || runtime.unlocked) {
      return;
    }

    runtime.unlocked = true;
    this.setRuntimeUnlocked(runtime, true);
  }

  update(onInteract: (target: StairTransitionTarget, stairId: string) => void): void {
    const activeRuntime = this.findOverlappedStair();

    if (!activeRuntime || !activeRuntime.unlocked) {
      this.scene.registry.set('interactionHint', '');
      this.resetInteractionPrompt();
      return;
    }

    this.scene.registry.set('interactionHint', 'E · INTERACTUAR');

    this.promptText
      .setText(activeRuntime.config.prompt)
      .setPosition(activeRuntime.config.x, activeRuntime.config.y - activeRuntime.config.height * 0.68)
      .setVisible(true);

    if (this.interactionKey.isDown) {
      if (this.holdingSinceMs === null) {
        this.holdingSinceMs = this.scene.time.now;
      }

      const holdElapsed = this.scene.time.now - this.holdingSinceMs;
      const holdProgress = Math.min(1, holdElapsed / INTERACTION_HOLD_DURATION_MS);
      this.holdProgressText
        .setText(`Activando escalera: ${Math.round(holdProgress * 100)}%`)
        .setPosition(activeRuntime.config.x, activeRuntime.config.y - activeRuntime.config.height * 0.48)
        .setVisible(true);

      if (holdProgress >= 1) {
        this.scene.registry.set('interactionHint', '');
        this.resetInteractionPrompt();
        onInteract(activeRuntime.config.target, activeRuntime.config.id);
      }

      return;
    }

    this.holdingSinceMs = null;
    this.holdProgressText.setVisible(false);
  }

  private findOverlappedStair(): StairRuntime | undefined {
    for (const stair of this.stairs.values()) {
      const stairBounds = stair.triggerZone.getBounds();

      const hasPlayerInStair = this.players.some((player) => {
        const playerBounds = player.getBounds();
        return Phaser.Geom.Intersects.RectangleToRectangle(stairBounds, playerBounds);
      });

      if (hasPlayerInStair) {
        return stair;
      }
    }

    return undefined;
  }

  private resetInteractionPrompt(): void {
    this.promptText.setVisible(false);
    this.holdProgressText.setVisible(false);
    this.holdingSinceMs = null;
  }

  private setRuntimeUnlocked(runtime: StairRuntime, unlocked: boolean): void {
    runtime.inactiveVisual.setVisible(!unlocked);
    runtime.activeVisual.setVisible(unlocked);
    runtime.label
      .setText(unlocked ? runtime.config.activeLabel : (runtime.config.inactiveLabel ?? 'ESCALERA\nBLOQUEADA'))
      .setColor(unlocked ? '#86efac' : '#f87171');
  }
}
