import Phaser from 'phaser';
import { Player } from '../entities/Player';

const INTERACT_DISTANCE_X = 95;
const INTERACT_DISTANCE_Y = 80;

export class StaircaseSystem {
  private readonly scene: Phaser.Scene;
  private readonly player: Player;
  private readonly interactionKey: Phaser.Input.Keyboard.Key;
  private readonly promptText: Phaser.GameObjects.Text;
  private readonly lockedVisual: Phaser.GameObjects.Rectangle;
  private readonly unlockedVisual: Phaser.GameObjects.Rectangle;
  private readonly unlockedLabel: Phaser.GameObjects.Text;
  private readonly stairsX: number;
  private readonly stairsY: number;
  private unlocked = false;

  constructor(scene: Phaser.Scene, player: Player, stairsX: number, stairsY: number) {
    this.scene = scene;
    this.player = player;
    this.stairsX = stairsX;
    this.stairsY = stairsY;

    this.lockedVisual = this.scene.add.rectangle(stairsX, stairsY, 150, 110, 0x111827, 0.85)
      .setStrokeStyle(2, 0x94a3b8, 0.8);

    this.scene.add.text(stairsX - 57, stairsY - 22, 'ESCALERA\nBLOQUEADA', {
      color: '#f87171',
      fontSize: '14px',
      align: 'center'
    });

    this.scene.add.rectangle(stairsX, stairsY + 20, 120, 10, 0xdc2626, 0.9);

    this.unlockedVisual = this.scene.add.rectangle(stairsX, stairsY, 150, 110, 0x14532d, 0.35)
      .setStrokeStyle(2, 0x86efac, 0.9)
      .setVisible(false);

    this.unlockedLabel = this.scene.add.text(stairsX - 54, stairsY - 22, 'ESCALERA\nACTIVA', {
      color: '#86efac',
      fontSize: '14px',
      align: 'center'
    }).setVisible(false);

    const keyboard = this.scene.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is not available in this scene.');
    }

    this.interactionKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    this.promptText = this.scene.add.text(0, 0, 'Pulsa E para subir', {
      color: '#dcfce7',
      fontSize: '16px',
      backgroundColor: '#052e16'
    }).setOrigin(0.5).setVisible(false);
  }

  unlock(): void {
    if (this.unlocked) {
      return;
    }

    this.unlocked = true;
    this.lockedVisual.setVisible(false);
    this.unlockedVisual.setVisible(true);
    this.unlockedLabel.setVisible(true);
  }

  update(onInteract: () => void): void {
    if (!this.unlocked) {
      this.promptText.setVisible(false);
      return;
    }

    const isPlayerNearStairs =
      Math.abs(this.player.x - this.stairsX) <= INTERACT_DISTANCE_X
      && Math.abs(this.player.y - this.stairsY) <= INTERACT_DISTANCE_Y;

    this.promptText
      .setVisible(isPlayerNearStairs)
      .setPosition(this.stairsX, this.stairsY - 84);

    if (isPlayerNearStairs && Phaser.Input.Keyboard.JustDown(this.interactionKey)) {
      onInteract();
    }
  }
}
