import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { StairAnimationKeys } from './StairSystem';

const DEFAULT_CLIMB_SPEED = 130;
const DEFAULT_ATTACH_MARGIN = 24;

export interface StairVectorPoint {
  x: number;
  y: number;
}

export interface StairSegmentZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StairSegmentConfig {
  id: string;
  start: StairVectorPoint;
  end: StairVectorPoint;
  zone: StairSegmentZone;
  nextUpSegmentId?: string;
  nextDownSegmentId?: string;
  climbSpeed?: number;
  attachMargin?: number;
  animations?: StairAnimationKeys;
}

export interface StairSegmentSystemConfig {
  segments: StairSegmentConfig[];
}

interface SegmentRuntime {
  config: StairSegmentConfig;
  zone: Phaser.GameObjects.Zone;
  length: number;
}

interface PlayerSegmentState {
  segmentId: string;
  progress: number;
}

export class StairSegmentSystem {
  private readonly scene: Phaser.Scene;
  private readonly segments = new Map<string, SegmentRuntime>();
  private readonly playerState = new WeakMap<Player, PlayerSegmentState>();

  constructor(scene: Phaser.Scene, config: StairSegmentSystemConfig) {
    this.scene = scene;

    config.segments.forEach((segment) => {
      const zone = this.scene.add.zone(segment.zone.x, segment.zone.y, segment.zone.width, segment.zone.height);
      this.scene.physics.add.existing(zone, true);

      const length = Phaser.Math.Distance.Between(segment.start.x, segment.start.y, segment.end.x, segment.end.y);
      this.segments.set(segment.id, {
        config: segment,
        zone,
        length: Math.max(length, 1)
      });
    });
  }

  static fromLegacyStairAreas(
    scene: Phaser.Scene,
    legacyConfig: {
      stairs: Array<{
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
      }>;
    }
  ): StairSegmentSystem {
    return new StairSegmentSystem(scene, {
      segments: legacyConfig.stairs.map((stair) => ({
        id: stair.id,
        start: { x: stair.alignX ?? stair.x, y: stair.bottomY },
        end: { x: stair.alignX ?? stair.x, y: stair.topY },
        zone: {
          x: stair.x,
          y: stair.y,
          width: stair.width,
          height: stair.height
        },
        attachMargin: stair.attachMargin,
        climbSpeed: stair.climbSpeed,
        animations: stair.animations
      }))
    });
  }

  update(players: Player[]): void {
    const deltaSeconds = this.scene.game.loop.delta / 1000;
    players.forEach((player) => this.updatePlayer(player, deltaSeconds));
  }

  private updatePlayer(player: Player, deltaSeconds: number): void {
    const state = this.playerState.get(player);
    if (!state) {
      if (!player.isClimbRequestActive()) {
        return;
      }

      const candidate = this.findOverlappedSegment(player);
      if (!candidate) {
        return;
      }

      const initialProgress = this.computeNearestProgress(player, candidate.config);
      this.attach(player, candidate.config, initialProgress);
      return;
    }

    const runtime = this.segments.get(state.segmentId);
    if (!runtime) {
      this.detach(player);
      return;
    }

    this.applyMovement(player, runtime, state, deltaSeconds);
  }

  private applyMovement(player: Player, runtime: SegmentRuntime, state: PlayerSegmentState, deltaSeconds: number): void {
    const segment = runtime.config;
    const body = player.body as Phaser.Physics.Arcade.Body | null;

    if (!this.isWithinAttachMargin(player, runtime)) {
      this.detach(player);
      return;
    }

    const moveDirection = this.getMoveDirection(player);
    const speed = segment.climbSpeed ?? DEFAULT_CLIMB_SPEED;
    const progressStep = (speed * deltaSeconds) / runtime.length;

    let nextProgress = state.progress;
    if (moveDirection !== 0) {
      nextProgress += progressStep * moveDirection;
      player.playClimbAnimation();
    } else {
      player.playClimbIdleAnimation();
    }

    if (nextProgress > 1) {
      const overflow = nextProgress - 1;
      const transitioned = this.transitionToLinkedSegment(player, segment.nextUpSegmentId, overflow);
      if (!transitioned) {
        this.detachAtBoundary(player, segment.end);
      }
      return;
    }

    if (nextProgress < 0) {
      const overflow = Math.abs(nextProgress);
      const transitioned = this.transitionToLinkedSegment(player, segment.nextDownSegmentId, 1 - overflow);
      if (!transitioned) {
        this.detachAtBoundary(player, segment.start);
      }
      return;
    }

    state.progress = Phaser.Math.Clamp(nextProgress, 0, 1);
    this.placePlayerAtProgress(player, segment, state.progress);

    if (body) {
      body.allowGravity = false;
      body.setVelocity(0, 0);
    }
  }

  private transitionToLinkedSegment(player: Player, segmentId: string | undefined, progress: number): boolean {
    if (!segmentId) {
      return false;
    }

    const target = this.segments.get(segmentId);
    if (!target) {
      return false;
    }

    this.attach(player, target.config, Phaser.Math.Clamp(progress, 0, 1));
    return true;
  }

  private attach(player: Player, segment: StairSegmentConfig, progress: number): void {
    this.playerState.set(player, {
      segmentId: segment.id,
      progress: Phaser.Math.Clamp(progress, 0, 1)
    });

    const body = player.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.allowGravity = false;
      body.setVelocity(0, 0);
    }

    this.placePlayerAtProgress(player, segment, progress);
    player.setClimbingState(true, segment.animations);
  }

  private detach(player: Player): void {
    const body = player.body as Phaser.Physics.Arcade.Body | null;
    if (body) {
      body.allowGravity = true;
      body.setVelocity(0, 0);
    }

    this.playerState.delete(player);
    player.setClimbingState(false);
  }

  private detachAtBoundary(player: Player, boundary: StairVectorPoint): void {
    player.setPosition(boundary.x, boundary.y);
    this.detach(player);
  }

  private placePlayerAtProgress(player: Player, segment: StairSegmentConfig, progress: number): void {
    player.setPosition(
      Phaser.Math.Linear(segment.start.x, segment.end.x, progress),
      Phaser.Math.Linear(segment.start.y, segment.end.y, progress)
    );
  }

  private findOverlappedSegment(player: Player): SegmentRuntime | undefined {
    const playerBounds = player.getBounds();

    for (const segment of this.segments.values()) {
      if (Phaser.Geom.Intersects.RectangleToRectangle(playerBounds, segment.zone.getBounds())) {
        return segment;
      }
    }

    return undefined;
  }

  private isWithinAttachMargin(player: Player, runtime: SegmentRuntime): boolean {
    const margin = runtime.config.attachMargin ?? DEFAULT_ATTACH_MARGIN;
    const expandedZone = runtime.zone.getBounds();
    expandedZone.x -= margin;
    expandedZone.y -= margin;
    expandedZone.width += margin * 2;
    expandedZone.height += margin * 2;

    return Phaser.Geom.Rectangle.Contains(expandedZone, player.x, player.y);
  }

  private computeNearestProgress(player: Player, segment: StairSegmentConfig): number {
    const segmentVector = new Phaser.Math.Vector2(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
    const pointVector = new Phaser.Math.Vector2(player.x - segment.start.x, player.y - segment.start.y);

    const lengthSquared = segmentVector.lengthSq();
    if (lengthSquared <= 0.0001) {
      return 0;
    }

    return Phaser.Math.Clamp(pointVector.dot(segmentVector) / lengthSquared, 0, 1);
  }

  private getMoveDirection(player: Player): number {
    const upPressed = player.isClimbUpPressed();
    const downPressed = player.isClimbDownPressed();

    if (upPressed === downPressed) {
      return 0;
    }

    return upPressed ? 1 : -1;
  }
}
