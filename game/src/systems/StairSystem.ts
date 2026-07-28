import Phaser from 'phaser';
import { Player } from '../entities/Player';

const DEFAULT_CLIMB_SPEED = 120;
const DEFAULT_ATTACH_MARGIN = 20;

export interface StairAnimationKeys {
  idle?: string;
  climb?: string;
}

export interface StairAreaConfig {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  topY: number;
  bottomY: number;
  alignX?: number;
  attachMargin?: number;
  climbSpeed?: number;
  animations?: StairAnimationKeys;
}

export interface StairSystemConfig {
  stairs: StairAreaConfig[];
}

interface PlayerStairState {
  stairId: string;
}

interface StairRuntime {
  config: StairAreaConfig;
  zone: Phaser.GameObjects.Zone;
}

export class StairSystem {
  private readonly scene: Phaser.Scene;
  private readonly stairs = new Map<string, StairRuntime>();
  private readonly playerState = new WeakMap<Player, PlayerStairState>();

  constructor(scene: Phaser.Scene, config: StairSystemConfig) {
    this.scene = scene;

    config.stairs.forEach((stair) => {
      const zone = this.scene.add.zone(stair.x, stair.y, stair.width, stair.height);
      this.scene.physics.add.existing(zone, true);
      this.stairs.set(stair.id, { config: stair, zone });
    });
  }

  update(players: Player[]): void {
    players.forEach((player) => this.updatePlayer(player));
  }

  private updatePlayer(player: Player): void {
    const currentState = this.playerState.get(player);
    const currentRuntime = currentState ? this.stairs.get(currentState.stairId) : undefined;

    if (currentRuntime) {
      if (this.shouldDetach(player, currentRuntime.config)) {
        this.detach(player);
        return;
      }

      this.applyClimbMovement(player, currentRuntime.config);
      return;
    }

    const candidate = this.findOverlappedStair(player);
    if (!candidate) {
      return;
    }

    if (!player.isClimbRequestActive()) {
      return;
    }

    this.attach(player, candidate.config);
    this.applyClimbMovement(player, candidate.config);
  }

  private attach(player: Player, stair: StairAreaConfig): void {
    const alignX = stair.alignX ?? stair.x;
    const body = player.body as Phaser.Physics.Arcade.Body | null;

    player.setX(alignX);
    if (body) {
      body.allowGravity = false;
    }

    this.playerState.set(player, { stairId: stair.id });
    player.setClimbingState(true, stair.animations);
  }

  private detach(player: Player): void {
    const body = player.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.allowGravity = true;
    }

    this.playerState.delete(player);
    player.setVelocityY(0);
    player.setClimbingState(false);
  }

  private shouldDetach(player: Player, stair: StairAreaConfig): boolean {
    if (!player.isClimbRequestActive()) {
      return true;
    }

    const margin = stair.attachMargin ?? DEFAULT_ATTACH_MARGIN;
    if (player.y <= stair.topY - margin || player.y >= stair.bottomY + margin) {
      return true;
    }

    return false;
  }

  private applyClimbMovement(player: Player, stair: StairAreaConfig): void {
    const speed = stair.climbSpeed ?? DEFAULT_CLIMB_SPEED;
    const upPressed = player.isClimbUpPressed();
    const downPressed = player.isClimbDownPressed();

    if (upPressed && !downPressed) {
      player.setVelocityY(-speed);
      player.playClimbAnimation();
      return;
    }

    if (downPressed && !upPressed) {
      player.setVelocityY(speed);
      player.playClimbAnimation();
      return;
    }

    player.setVelocityY(0);
    player.playClimbIdleAnimation();
  }

  private findOverlappedStair(player: Player): StairRuntime | undefined {
    const playerBounds = player.getBounds();

    for (const stair of this.stairs.values()) {
      if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, stair.zone.getBounds())) {
        return stair;
      }
    }

    return undefined;
  }
}
