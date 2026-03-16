import Phaser from 'phaser';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { PlayerConfig } from '../config/localMultiplayer';
import { StairAnimationKeys } from '../systems/StairSystem';
import { getCharacterVisualById } from '../config/characterVisuals';
import { getAudioManager } from '../audio/AudioManager';
import { CharacterRuntimeConfig, CharacterWeaponSlot, getCharacterRuntimeConfig } from '../config/characterRuntime';
import { getWeaponVisualRuntimeConfig } from '../config/weaponVisualRuntime';
import { getWeaponCatalogEntry } from '../config/weaponCatalog';
import { WeaponAmmoRuntime } from './combat/WeaponAmmoRuntime';
import { SpriteAnimationSystem } from '../systems/SpriteAnimationSystem';

const MOVE_SPEED = 220;
const JUMP_SPEED = 420;
const DAMAGE_INVULNERABILITY_MS = 900;

export class Player extends Phaser.Physics.Arcade.Sprite {
  private readonly leftKey: Phaser.Input.Keyboard.Key;
  private readonly rightKey: Phaser.Input.Keyboard.Key;
  private readonly jumpKey: Phaser.Input.Keyboard.Key;
  private readonly downKey: Phaser.Input.Keyboard.Key;
  private readonly shootKey: Phaser.Input.Keyboard.Key;
  private readonly reloadKey: Phaser.Input.Keyboard.Key;
  private readonly switchWeaponKey: Phaser.Input.Keyboard.Key;
  private readonly interactKey: Phaser.Input.Keyboard.Key;
  private lookDirection: 1 | -1 = 1;
  private projectileSystem: ProjectileSystem;
  private readonly runtimeConfig: CharacterRuntimeConfig;
  private activeWeaponSlot: CharacterWeaponSlot;
  private readonly ammoRuntime: WeaponAmmoRuntime;
  private healthPoints = 0;
  private invulnerableUntil = 0;
  private isDeadState = false;
  private isReloading = false;
  private reloadingWeaponKey?: string;
  private reloadEndsAt = 0;
  private readonly profile: PlayerConfig;
  private readonly characterVisualId: string;
  private readonly nameTag: Phaser.GameObjects.Text;
  private isClimbing = false;
  private climbAnimations: StairAnimationKeys = {};
  private attackRequestedThisFrame = false;
  private isDefensiveStateActive = false;
  private defenseMitigationRatio = 0;
  private defenseFrontalOnly = true;
  private readonly spriteAnimationSystem: SpriteAnimationSystem;

  constructor(scene: Phaser.Scene, x: number, y: number, projectileSystem: ProjectileSystem, profile: PlayerConfig) {
    const characterVisual = getCharacterVisualById(profile.characterId);
    super(scene, x, y, `${characterVisual.id}-sheet`, 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setSize(18, 40);
    this.setOffset(7, 8);

    this.projectileSystem = projectileSystem;
    this.profile = profile;
    this.characterVisualId = characterVisual.id;
    this.runtimeConfig = getCharacterRuntimeConfig(profile.characterId);
    this.activeWeaponSlot = this.runtimeConfig.loadout.activeSlot;
    this.ammoRuntime = new WeaponAmmoRuntime(this.runtimeConfig.loadout);
    this.spriteAnimationSystem = new SpriteAnimationSystem(scene);
    this.healthPoints = this.runtimeConfig.maxHealth;
    this.setTint(profile.color);
    this.spriteAnimationSystem.rememberDefaultTint(this, profile.color);

    const keyboard = scene.input.keyboard;
    if (!keyboard) {
      throw new Error('Keyboard input is not available in this scene.');
    }

    this.leftKey = keyboard.addKey(profile.controls.left);
    this.rightKey = keyboard.addKey(profile.controls.right);
    this.jumpKey = keyboard.addKey(profile.controls.jump);
    this.downKey = keyboard.addKey(profile.controls.down);
    this.shootKey = keyboard.addKey(profile.controls.shoot);
    this.reloadKey = keyboard.addKey(profile.controls.reload);
    this.switchWeaponKey = keyboard.addKey(profile.controls.switchWeapon);
    this.interactKey = keyboard.addKey(profile.controls.interact);

    this.spriteAnimationSystem.playState(this, this.characterVisualId, 'idle');

    this.nameTag = scene.add.text(this.x, this.y - 42, this.runtimeConfig.name, {
      fontSize: '10px',
      color: '#f8fafc',
      stroke: '#0f172a',
      strokeThickness: 3,
      fontStyle: 'bold'
    });
    this.nameTag.setOrigin(0.5, 1);
    this.nameTag.setDepth(30);
  }

  update(): void {
    if (this.isDeadState) {
      this.setVelocity(0, 0);
      return;
    }

    this.completeReloadIfNeeded();

    let isMovingHorizontally = false;

    if (this.isClimbing) {
      this.setVelocityX(0);
    } else if (this.leftKey.isDown) {
      this.setVelocityX(-MOVE_SPEED);
      this.lookDirection = -1;
      this.setFlipX(true);
      isMovingHorizontally = true;
    } else if (this.rightKey.isDown) {
      this.setVelocityX(MOVE_SPEED);
      this.lookDirection = 1;
      this.setFlipX(false);
      isMovingHorizontally = true;
    } else {
      this.setVelocityX(0);
    }

    const body = this.body as Phaser.Physics.Arcade.Body | null;

    if (!this.isClimbing && this.jumpKey.isDown && body?.blocked.down) {
      this.setVelocityY(-JUMP_SPEED);
    }

    if (Phaser.Input.Keyboard.JustDown(this.switchWeaponKey)) {
      const switched = this.switchActiveWeaponSlot();
      if (switched) {
        this.cancelReload();
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.reloadKey)) {
      this.startReloadActiveWeapon();
    }

    this.attackRequestedThisFrame = Phaser.Input.Keyboard.JustDown(this.shootKey);
    if (this.attackRequestedThisFrame) {
      this.tryShootActiveWeapon();
    }

    if (!this.isClimbing && (!this.anims.isPlaying || this.anims.currentAnim?.key === `${this.characterVisualId}-idle` || this.anims.currentAnim?.key === `${this.characterVisualId}-run`)) {
      this.spriteAnimationSystem.playMovement(this, this.characterVisualId, isMovingHorizontally);
    }

    this.updateNameTagPosition();
  }


  isClimbUpPressed(): boolean {
    return this.jumpKey.isDown;
  }

  isClimbDownPressed(): boolean {
    return this.downKey.isDown;
  }

  isClimbRequestActive(): boolean {
    return this.isClimbUpPressed() || this.isClimbDownPressed();
  }

  isInteractJustPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.interactKey);
  }

  isReloadJustPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.reloadKey);
  }

  setClimbingState(isClimbing: boolean, animations?: StairAnimationKeys): void {
    this.isClimbing = isClimbing;
    if (animations) {
      this.climbAnimations = animations;
    }

    if (!isClimbing) {
      this.play(this.climbAnimations.idle ?? `${this.characterVisualId}-idle`, true);
    }
  }

  playClimbAnimation(): void {
    this.play(this.climbAnimations.climb ?? `${this.characterVisualId}-run`, true);
  }

  playClimbIdleAnimation(): void {
    this.play(this.climbAnimations.idle ?? `${this.characterVisualId}-idle`, true);
  }

  takeDamage(amount: number, currentTime: number, context?: { sourceX?: number }): boolean {
    if (amount <= 0 || !this.active || this.isDeadState || !this.canTakeDamage(currentTime)) {
      return false;
    }

    const appliedDamage = this.getDefendedDamage(amount, context);

    this.healthPoints = Math.max(0, this.healthPoints - appliedDamage);
    this.invulnerableUntil = currentTime + DAMAGE_INVULNERABILITY_MS;
    this.spriteAnimationSystem.playHurt(this, this.characterVisualId);
    getAudioManager(this.scene).play('playerDamage', { x: this.x, y: this.y });
    this.setTintFill(0xf87171);
    this.scene.time.delayedCall(120, () => {
      if (this.active) {
        this.clearTint();
        this.setTint(this.profile.color);
      }
    });

    if (this.healthPoints <= 0) {
      this.isDeadState = true;
      this.setVelocity(0, 0);
    }

    return true;
  }

  getCombatActorId(): string {
    return `player-${this.profile.slot}`;
  }

  getLookDirection(): 1 | -1 {
    return this.lookDirection;
  }

  getActiveWeaponRuntime() {
    return this.runtimeConfig.weaponRuntimeBySlot[this.activeWeaponSlot] ?? this.runtimeConfig.weaponRuntimeBySlot.primary ?? this.runtimeConfig.weaponRuntime;
  }

  consumeAttackRequest(): boolean {
    const requested = this.attackRequestedThisFrame;
    this.attackRequestedThisFrame = false;
    return requested;
  }

  isAttackHeld(): boolean {
    return this.shootKey.isDown;
  }

  setDefensiveState(active: boolean, config: { mitigationRatio: number; frontalOnly: boolean }): void {
    this.isDefensiveStateActive = active;
    this.defenseMitigationRatio = Phaser.Math.Clamp(config.mitigationRatio, 0, 0.9);
    this.defenseFrontalOnly = config.frontalOnly;
  }

  playCombatAttackAnimation(): void {
    const weaponVisual = getWeaponVisualRuntimeConfig(this.getActiveWeaponRuntime().key);
    this.spriteAnimationSystem.playShootEffect(this, this.characterVisualId, this.lookDirection, {
      x: weaponVisual.muzzleOffsetX,
      y: weaponVisual.muzzleOffsetY
    });
  }

  canTakeDamage(currentTime: number): boolean {
    return currentTime >= this.invulnerableUntil;
  }

  isDead(): boolean {
    return this.isDeadState;
  }

  getHealth(): number {
    return this.healthPoints;
  }

  getMaxHealth(): number {
    return this.runtimeConfig.maxHealth;
  }

  restoreHealth(amount: number): number {
    const normalized = Math.max(0, Math.floor(amount));
    if (normalized <= 0 || this.isDeadState) {
      return 0;
    }

    const previous = this.healthPoints;
    this.healthPoints = Math.min(this.runtimeConfig.maxHealth, this.healthPoints + normalized);
    return this.healthPoints - previous;
  }

  addAmmoReserve(ammoType: string, amount: number): number {
    if (!this.ammoRuntime.hasWeaponUsingAmmoType(ammoType)) {
      return 0;
    }

    return this.ammoRuntime.addReserveByAmmoType(ammoType, amount);
  }

  canReceiveAmmoType(ammoType: string): boolean {
    return this.ammoRuntime.hasWeaponUsingAmmoType(ammoType);
  }

  getActiveWeaponSlot(): CharacterWeaponSlot {
    return this.activeWeaponSlot;
  }

  switchActiveWeaponSlot(slot?: CharacterWeaponSlot): boolean {
    const requestedSlot = slot ?? (this.activeWeaponSlot === 'primary' ? 'secondary' : 'primary');
    if (requestedSlot === this.activeWeaponSlot) {
      return true;
    }

    if (!this.runtimeConfig.weaponRuntimeBySlot[requestedSlot]) {
      return false;
    }

    this.activeWeaponSlot = requestedSlot;
    return true;
  }

  getInventoryState(): {
    primaryWeapon: string;
    secondaryWeapon?: string;
    activeSlot: CharacterWeaponSlot;
    activeWeapon: string;
    usesAmmo: boolean;
    ammoType?: string;
    ammoCurrent?: number;
    ammoMax?: number;
    ammoReserve?: number;
    isReloading: boolean;
  } {
    const activeWeapon = this.getActiveWeaponRuntime().key;
    const ammo = this.ammoRuntime.getSnapshotForWeapon(activeWeapon);

    return {
      primaryWeapon: this.runtimeConfig.loadout.primaryWeapon,
      secondaryWeapon: this.runtimeConfig.loadout.secondaryWeapon,
      activeSlot: this.activeWeaponSlot,
      activeWeapon,
      usesAmmo: ammo.usesAmmo,
      ammoType: ammo.ammoType,
      ammoCurrent: ammo.ammoCurrent,
      ammoMax: ammo.ammoMax,
      ammoReserve: ammo.ammoReserve,
      isReloading: this.isReloading
    };
  }

  getRuntimeConfig(): CharacterRuntimeConfig {
    return this.runtimeConfig;
  }

  getProfile(): PlayerConfig {
    return this.profile;
  }

  destroy(fromScene?: boolean): void {
    this.nameTag.destroy();
    super.destroy(fromScene);
  }


  private tryShootActiveWeapon(): boolean {
    if (this.isReloading) {
      return false;
    }

    const activeWeapon = this.getActiveWeaponRuntime();
    const ammoSnapshot = this.ammoRuntime.getSnapshotForWeapon(activeWeapon.key);
    if (!this.ammoRuntime.canFire(activeWeapon.key)) {
      return false;
    }

    const weaponVisual = getWeaponVisualRuntimeConfig(activeWeapon.key);
    const hasFired = this.projectileSystem.tryFire({
      originX: this.x + this.lookDirection * weaponVisual.muzzleOffsetX,
      originY: this.y + weaponVisual.muzzleOffsetY,
      direction: this.lookDirection,
      weapon: activeWeapon.key,
      shooterId: `player-${this.profile.slot}`,
      shooterCharacterId: this.runtimeConfig.characterId,
      activeWeapon: {
        key: activeWeapon.key,
        usesAmmo: ammoSnapshot.usesAmmo,
        ammoCurrent: ammoSnapshot.ammoCurrent
      }
    });

    if (!hasFired) {
      return false;
    }

    this.ammoRuntime.consumeForShot(activeWeapon.key);
    this.play(`${this.characterVisualId}-shoot`, true);
    return true;
  }

  private startReloadActiveWeapon(): boolean {
    if (this.isReloading) {
      return false;
    }

    const activeWeapon = this.getActiveWeaponRuntime().key;
    const weaponCatalog = getWeaponCatalogEntry(activeWeapon);
    if (!this.ammoRuntime.canReload(activeWeapon)) {
      return false;
    }

    this.isReloading = true;
    this.reloadingWeaponKey = activeWeapon;
    this.reloadEndsAt = this.scene.time.now + Math.max(0, weaponCatalog.reloadTimeMs);
    getAudioManager(this.scene).play('reload', { x: this.x, y: this.y, volume: 0.2 });
    return true;
  }

  private completeReloadIfNeeded(): void {
    if (!this.isReloading || this.scene.time.now < this.reloadEndsAt) {
      return;
    }

    if (this.reloadingWeaponKey) {
      this.ammoRuntime.reload(this.reloadingWeaponKey);
    }

    this.isReloading = false;
    this.reloadingWeaponKey = undefined;
    this.reloadEndsAt = 0;
  }

  private cancelReload(): void {
    this.isReloading = false;
    this.reloadingWeaponKey = undefined;
    this.reloadEndsAt = 0;
  }

  private updateNameTagPosition(): void {
    this.nameTag.setPosition(this.x, this.y - 42);
  }

  private getDefendedDamage(baseDamage: number, context?: { sourceX?: number }): number {
    if (!this.isDefensiveStateActive) {
      return baseDamage;
    }

    if (this.defenseFrontalOnly && context?.sourceX !== undefined) {
      const attackDirection = Math.sign(context.sourceX - this.x) || this.lookDirection;
      const isFrontalAttack = attackDirection === this.lookDirection;
      if (!isFrontalAttack) {
        return baseDamage;
      }
    }

    return Math.max(1, Math.round(baseDamage * (1 - this.defenseMitigationRatio)));
  }
}
