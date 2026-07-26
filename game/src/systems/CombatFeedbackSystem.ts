import Phaser from 'phaser';
import { getWeaponCatalogEntry } from '../config/weaponCatalog.ts';
import { getWeaponVisualRuntimeConfig } from '../config/weaponVisualRuntime.ts';
import { getFacingOffsetPosition } from '../config/visualAlignment.ts';

export interface ShotFeedbackInput {
  x: number; y: number; direction: -1 | 1; weaponKey: string;
  source: Phaser.GameObjects.Sprite; weaponSprite?: Phaser.GameObjects.Image; isPlayerControlled: boolean;
}

export interface HitFeedbackInput {
  x: number; y: number; damage: number; killed: boolean; sourceX?: number; target: Phaser.GameObjects.Sprite;
}

export interface EnvironmentImpactInput {
  x: number; y: number; weaponKey: string; direction: -1 | 1; isMetal?: boolean;
}

export class CombatFeedbackSystem {
  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;
  private readonly activeShells = new Set<Phaser.GameObjects.Image>();
  private readonly activeBloodDrops = new Set<Phaser.GameObjects.Image>();
  private readonly activeImpacts = new Set<Phaser.GameObjects.Image>();
  private readonly activeMuzzleFlashes = new Set<Phaser.GameObjects.Image>();
  private readonly timers = new Set<Phaser.Time.TimerEvent>();
  private hitStopToken = 0;
  private destroyed = false;

  constructor(scene: Phaser.Scene, camera: Phaser.Cameras.Scene2D.Camera) {
    this.scene = scene;
    this.camera = camera;
    this.scene.events.on(Phaser.Scenes.Events.PAUSE, this.restorePhysicsTimeScale, this);
  }

  playShot(input: ShotFeedbackInput): void {
    if (!this.canPlay()) return;
    const weapon = getWeaponCatalogEntry(input.weaponKey);
    const weaponVisual = getWeaponVisualRuntimeConfig(input.weaponKey, this.scene);
    if (weapon.isMelee || weapon.isDefensive || weapon.key === 'tray_shield') return;
    const textures: Record<string, string> = { pistol: 'fx-muzzle-pistol', revolver: 'fx-muzzle-pistol', smg: 'fx-muzzle-rifle', carbine: 'fx-muzzle-rifle', sniper_rifle: 'fx-muzzle-rifle', shotgun: 'fx-muzzle-shotgun', light_machine_gun: 'fx-muzzle-heavy' };
    const durations: Record<string, number> = { pistol: 60, revolver: 70, smg: 50, carbine: 62, shotgun: 85, sniper_rifle: 78, light_machine_gun: 52 };
    const recoil: Record<string, number> = { pistol: 2, revolver: 3, smg: 2, shotgun: 5, carbine: 3, sniper_rifle: 5, light_machine_gun: 3 };
    const muzzle = getFacingOffsetPosition(
      { x: input.x, y: input.y },
      { x: weaponVisual.muzzleOffsetX, y: weaponVisual.muzzleOffsetY },
      input.direction
    );
    const muzzleX = muzzle.x;
    const muzzleY = muzzle.y;
    const flash = this.scene.add.image(muzzleX, muzzleY, textures[weapon.key] ?? 'fx-muzzle-pistol')
      .setFlipX(input.direction < 0).setDepth(input.source.depth + 1).setAlpha(1);
    this.track(this.activeMuzzleFlashes, flash, 8);
    this.scene.tweens.add({ targets: flash, scale: 1.2, alpha: 0, duration: durations[weapon.key] ?? 60, onComplete: () => this.removeAndDestroy(this.activeMuzzleFlashes, flash) });

    if (input.weaponSprite) {
      const originalX = input.weaponSprite.x;
      const originalY = input.weaponSprite.y;
      this.scene.tweens.killTweensOf(input.weaponSprite);
      this.scene.tweens.add({
        targets: input.weaponSprite,
        x: originalX - input.direction * (recoil[weapon.key] ?? 2),
        y: originalY,
        duration: 32,
        yoyo: true,
        hold: 4,
        onComplete: () => {
          if (!this.destroyed && this.scene.sys.isActive() && input.weaponSprite?.active && input.weaponSprite.scene) {
            input.weaponSprite.setPosition(originalX, originalY);
          }
        }
      });
    }
    if (weapon.key !== 'shotgun' && weapon.key !== 'revolver') this.ejectShell(input, weapon.key === 'sniper_rifle' || weapon.key === 'light_machine_gun');

    const shakes: Record<string, [number, number]> = { revolver: [45, 0.0012], shotgun: [70, 0.0022], carbine: [35, 0.0008], sniper_rifle: [80, 0.0026], light_machine_gun: [35, 0.001] };
    const shake = shakes[weapon.key];
    if (input.isPlayerControlled && shake && this.camera && this.scene.sys.isActive()) this.camera.shake(shake[0], shake[1]);
  }

  playZombieHit(input: HitFeedbackInput): void {
    if (!this.canPlay()) return;
    const impact = this.scene.add.image(input.x, input.y - 12, 'fx-hit-flesh').setDepth(input.target.depth + 2);
    this.track(this.activeImpacts, impact, 12);
    this.scene.tweens.add({ targets: impact, scale: 1.25, angle: 20, alpha: 0, duration: 110, onComplete: () => this.removeAndDestroy(this.activeImpacts, impact) });
    const count = input.killed ? 3 : input.damage <= 1 ? 2 : input.damage === 2 ? 3 : 4;
    this.spawnBlood(input.x, input.y - 8, count, input.target.depth + 1);
    if (input.damage >= 3 || input.killed) this.spawnMist(input.x, input.y - 10, input.target.depth + 1);

    const originalTint = input.target.tintTopLeft;
    input.target.setTintFill(0xf8fafc);
    this.delay(55, () => {
      if (input.target.active) {
        input.target.clearTint();
        if (originalTint !== 0xffffff) input.target.setTint(originalTint);
      }
    });
    const originX = input.target.displayOriginX;
    const direction = input.sourceX === undefined ? 1 : (input.x >= input.sourceX ? 1 : -1);
    this.scene.tweens.killTweensOf(input.target);
    this.scene.tweens.add({ targets: input.target, displayOriginX: originX - direction * 3, duration: 28, yoyo: true, onComplete: () => {
      if (!this.destroyed && this.scene.sys.isActive() && input.target.active && input.target.scene) input.target.displayOriginX = originX;
    } });
    if (input.damage >= 3 || input.killed) this.playHitStop(input.killed ? 45 : input.damage >= 4 ? 38 : 28);
    if (input.killed) this.playDeath(input);
  }

  playEnvironmentImpact(input: EnvironmentImpactInput): void {
    if (!this.canPlay()) return;
    const impact = this.scene.add.image(input.x, input.y, input.isMetal ? 'fx-hit-metal' : 'fx-impact-spark').setFlipX(input.direction < 0).setDepth(30);
    this.track(this.activeImpacts, impact, 12);
    this.scene.tweens.add({ targets: impact, scale: 1.2, alpha: 0, duration: 100, onComplete: () => this.removeAndDestroy(this.activeImpacts, impact) });
    [-1, 1].forEach((vertical, index) => {
      const spark = this.scene.add.image(input.x, input.y, 'fx-impact-spark').setScale(0.45).setDepth(30);
      this.track(this.activeImpacts, spark, 12);
      this.scene.tweens.add({ targets: spark, x: input.x - input.direction * (5 + index * 3), y: input.y + vertical * 5, alpha: 0, duration: 100, onComplete: () => this.removeAndDestroy(this.activeImpacts, spark) });
    });
  }

  destroy(): void {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.hitStopToken += 1;
    this.scene.events.off(Phaser.Scenes.Events.PAUSE, this.restorePhysicsTimeScale, this);
    this.timers.forEach((timer) => {
      if (timer && typeof timer.remove === 'function') {
        timer.remove(false);
      }
    });
    this.timers.clear();

    const trackedObjects = [this.activeShells, this.activeBloodDrops, this.activeImpacts, this.activeMuzzleFlashes];
    const tweenManager = this.getTweenManager();
    trackedObjects.forEach((set) => {
      set.forEach((object) => {
        if (tweenManager && object?.scene) {
          tweenManager.killTweensOf(object);
        }
      });
    });

    this.restorePhysicsTimeScale();
    trackedObjects.forEach((set) => {
      set.forEach((object) => {
        if (object?.scene && object.active) {
          object.destroy();
        }
      });
      set.clear();
    });
  }

  private ejectShell(input: ShotFeedbackInput, large: boolean): void {
    const shell = this.scene.add.image(input.x - input.direction * 2, input.y - 12, large ? 'fx-shell-large' : 'fx-shell-small').setDepth(input.source.depth + 1);
    this.track(this.activeShells, shell, 40); this.scene.physics.add.existing(shell);
    const body = shell.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(-input.direction * (large ? 34 : 46), large ? -72 : -82); body.setGravityY(220); body.setAngularVelocity(input.direction * (large ? 220 : 320)); body.setAllowGravity(true);
    this.delay(520, () => {
      const tweenManager = this.getTweenManager();
      if (shell.active && shell.scene && tweenManager) tweenManager.add({ targets: shell, alpha: 0, duration: 180 });
    });
    this.delay(700, () => this.removeAndDestroy(this.activeShells, shell));
  }

  private spawnBlood(x: number, y: number, count: number, depth: number): void {
    const vx = [-42, -18, 22, 44]; const vy = [-52, -75, -35, -64]; const life = [420, 500, 560, 620];
    for (let index = 0; index < count; index += 1) {
      const drop = this.scene.add.image(x + index - 2, y, 'fx-blood-drop').setDepth(depth); this.track(this.activeBloodDrops, drop, 32); this.scene.physics.add.existing(drop);
      const body = drop.body as Phaser.Physics.Arcade.Body; body.setVelocity(vx[index], vy[index]); body.setGravityY(160); body.setAllowGravity(true);
      this.scene.tweens.add({ targets: drop, alpha: 0, duration: life[index], onComplete: () => this.removeAndDestroy(this.activeBloodDrops, drop) });
    }
  }

  private spawnMist(x: number, y: number, depth: number): void {
    const mist = this.scene.add.image(x, y, 'fx-blood-mist').setDepth(depth); this.track(this.activeImpacts, mist, 12);
    this.scene.tweens.add({ targets: mist, scale: 1.2, alpha: 0, duration: 180, onComplete: () => this.removeAndDestroy(this.activeImpacts, mist) });
  }

  private playDeath(input: HitFeedbackInput): void {
    const shadow = this.scene.add.image(input.x, input.y + 17, 'fx-death-shadow').setAlpha(0.28).setDepth(input.target.depth - 1);
    this.track(this.activeImpacts, shadow, 12); this.scene.tweens.add({ targets: shadow, scaleX: 1.16, scaleY: 1.08, alpha: 0, duration: 500, onComplete: () => this.removeAndDestroy(this.activeImpacts, shadow) });
    const center = this.camera.midPoint;
    if (input.damage >= 3 && Phaser.Math.Distance.Between(input.x, input.y, center.x, center.y) < 260) this.camera.shake(45, 0.0012);
  }

  private playHitStop(duration: number): void {
    const world = this.getPhysicsWorld();

    if (!world || this.destroyed) {
      return;
    }

    const token = ++this.hitStopToken;
    world.timeScale = 0.18;

    this.delay(duration, () => {
      if (this.destroyed || token !== this.hitStopToken) {
        return;
      }

      const activeWorld = this.getPhysicsWorld();
      if (activeWorld) {
        activeWorld.timeScale = 1;
      }
    });
  }

  private getPhysicsWorld(): Phaser.Physics.Arcade.World | null {
    const sceneWithPhysics = this.scene as Phaser.Scene & {
      physics?: Phaser.Physics.Arcade.ArcadePhysics;
    };

    return sceneWithPhysics.physics?.world ?? null;
  }

  private getTweenManager(): Phaser.Tweens.TweenManager | null {
    const sceneWithTweens = this.scene as Phaser.Scene & { tweens?: Phaser.Tweens.TweenManager };
    return sceneWithTweens.tweens ?? null;
  }

  private restorePhysicsTimeScale(): void {
    this.hitStopToken += 1;
    const world = this.getPhysicsWorld();

    if (!world) {
      return;
    }

    world.timeScale = 1;
  }

  private canPlay(): boolean { return !this.destroyed && this.scene.sys.isActive() && this.scene.registry.get('isGamePaused') !== true; }
  private delay(delayMs: number, callback: () => void): void {
    if (this.destroyed || !this.scene.time) {
      return;
    }

    let timer: Phaser.Time.TimerEvent;
    timer = this.scene.time.delayedCall(delayMs, () => {
      this.timers.delete(timer);

      if (this.destroyed || !this.scene.sys.isActive()) {
        return;
      }

      callback();
    });
    this.timers.add(timer);
  }
  private track<T extends Phaser.GameObjects.Image>(set: Set<T>, object: T, limit: number): void {
    if (set.size >= limit) { const oldest = set.values().next().value as T | undefined; if (oldest) this.removeAndDestroy(set, oldest); } set.add(object);
  }
  private removeAndDestroy<T extends Phaser.GameObjects.Image>(set: Set<T>, object: T): void {
    set.delete(object);
    if (!this.destroyed && object?.active && object.scene && this.scene.sys.isActive()) object.destroy();
  }
}
