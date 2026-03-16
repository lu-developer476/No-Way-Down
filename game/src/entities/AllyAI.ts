import Phaser from 'phaser';
import { Player } from './Player';
import { Zombie } from './Zombie';
import { getCharacterVisualById } from '../config/characterVisuals';
import { CharacterRuntimeConfig, CharacterWeaponSlot, getCharacterRuntimeConfig } from '../config/characterRuntime';
import { ProjectileSystem } from '../systems/ProjectileSystem';
import { getWeaponVisualRuntimeConfig } from '../config/weaponVisualRuntime';
import { WeaponAmmoRuntime } from './combat/WeaponAmmoRuntime';
import { getWeaponCatalogEntry } from '../config/weaponCatalog';
import { CombatActionSystem } from '../systems/CombatActionSystem';

const ALLY_FOLLOW_SPEED = 170;
const ALLY_ATTACK_APPROACH_SPEED = 195;
const ALLY_STOP_RADIUS = 24;
const ALLY_CATCHUP_DISTANCE = 260;
const ALLY_TELEPORT_DISTANCE = 620;
const ALLY_TARGET_DETECTION_RANGE = 340;
const ALLY_ATTACK_RANGE = 210;
const ALLY_ATTACK_MIN_DISTANCE = 92;
const ALLY_COMBAT_REPOSITION_DISTANCE = 130;
const ALLY_MELEE_SWITCH_DISTANCE = 78;
const ALLY_DEFENSE_SWITCH_DISTANCE = 68;
const ALLY_SAFE_RELOAD_DISTANCE = 165;
const ALLY_LOW_AMMO_RATIO = 0.25;
const ALLY_PLAYER_BLOCK_RADIUS = 32;
const ALLY_TARGET_MEMORY_MS = 1200;
const ALLY_TARGET_SWITCH_BIAS = 48;

export interface AllyProfile {
  id: string;
  name: string;
  characterId: string;
  followOffsetX: number;
  followOffsetY: number;
  tint: number;
}

export class AllyAI extends Phaser.Physics.Arcade.Sprite {
  private readonly profile: AllyProfile;
  private readonly characterVisualId: string;
  private readonly nameTag: Phaser.GameObjects.Text;
  private isNameTagVisible = true;
  private readonly runtimeConfig: CharacterRuntimeConfig;
  private readonly projectileSystem: ProjectileSystem;
  private readonly combatActionSystem: CombatActionSystem;
  private activeWeaponSlot: CharacterWeaponSlot;
  private readonly ammoRuntime: WeaponAmmoRuntime;
  private isReloading = false;
  private reloadingWeaponKey?: string;
  private reloadEndsAt = 0;
  private currentHealth: number;
  private readonly maxHealth: number;
  private currentTargetId?: Zombie;
  private currentTargetLockedUntil = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, profile: AllyProfile, projectileSystem: ProjectileSystem, combatActionSystem: CombatActionSystem) {
    const visual = getCharacterVisualById(profile.characterId);
    super(scene, x, y, `${visual.id}-base-0`);

    this.profile = profile;
    this.characterVisualId = visual.id;
    this.runtimeConfig = getCharacterRuntimeConfig(profile.characterId);
    this.activeWeaponSlot = this.runtimeConfig.loadout.activeSlot;
    this.ammoRuntime = new WeaponAmmoRuntime(this.runtimeConfig.loadout);
    this.projectileSystem = projectileSystem;
    this.combatActionSystem = combatActionSystem;
    this.maxHealth = this.runtimeConfig.maxHealth;
    this.currentHealth = this.maxHealth;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setSize(18, 40);
    this.setOffset(7, 8);
    this.setTint(profile.tint);
    this.setAlpha(0.92);
    this.setPushable(false);

    this.play(`${this.characterVisualId}-idle`, true);

    this.nameTag = scene.add.text(this.x, this.y - 42, this.runtimeConfig.name, {
      fontSize: '10px',
      color: '#99f6e4',
      stroke: '#042f2e',
      strokeThickness: 3,
      fontStyle: 'bold'
    });
    this.nameTag.setOrigin(0.5, 1);
    this.nameTag.setDepth(25);
  }

  getId(): string {
    return this.profile.id;
  }

  getRuntimeConfig(): CharacterRuntimeConfig {
    return this.runtimeConfig;
  }

  getHealth(): number {
    return this.currentHealth;
  }

  getMaxHealth(): number {
    return this.maxHealth;
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

  setNameTagVisible(visible: boolean): void {
    this.isNameTagVisible = visible;
    this.nameTag.setVisible(this.active && visible);
  }

  updateAI(player: Player, zombies: Zombie[], currentTime: number): void {
    if (!this.active) {
      return;
    }

    const target = this.pickTarget(zombies, player, currentTime);
    if (target) {
      this.handleCombat(player, target, currentTime);
      return;
    }

    this.followPlayer(player);
  }

  private followPlayer(player: Player): void {
    const desiredX = player.x + this.profile.followOffsetX;
    const desiredY = player.y + this.profile.followOffsetY;

    this.moveTowards(desiredX, desiredY, ALLY_FOLLOW_SPEED, ALLY_STOP_RADIUS);
    this.avoidBlockingPlayer(player);
  }

  private handleCombat(player: Player, target: Zombie, currentTime: number): void {
    const distanceToTarget = Phaser.Math.Distance.Between(this.x, this.y, target.x, target.y);
    const combatAnchor = this.getCombatAnchor(player, target);

    this.completeReloadIfNeeded();
    this.updateCombatLoadout(distanceToTarget);

    const activeWeapon = this.getActiveWeaponRuntime();
    const activeCatalog = getWeaponCatalogEntry(activeWeapon.key);

    if (distanceToTarget < ALLY_ATTACK_MIN_DISTANCE) {
      this.moveTowards(combatAnchor.x, combatAnchor.y, ALLY_ATTACK_APPROACH_SPEED * 0.9, ALLY_STOP_RADIUS + 10);
      return;
    }

    if (activeCatalog.isDefensive && distanceToTarget <= ALLY_DEFENSE_SWITCH_DISTANCE) {
      this.moveTowards(combatAnchor.x, combatAnchor.y, ALLY_FOLLOW_SPEED * 0.85, ALLY_STOP_RADIUS + 14);
      return;
    }

    if (distanceToTarget <= ALLY_ATTACK_RANGE) {
      this.moveTowards(combatAnchor.x, combatAnchor.y, ALLY_FOLLOW_SPEED * 0.95, ALLY_STOP_RADIUS + 16);
      this.tryAttackTarget(target);
      return;
    }

    this.moveTowards(combatAnchor.x, combatAnchor.y, ALLY_ATTACK_APPROACH_SPEED, ALLY_STOP_RADIUS);
  }

  private moveTowards(targetX: number, targetY: number, baseSpeed: number, stopRadius: number): void {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > ALLY_TELEPORT_DISTANCE) {
      this.recoverNearPoint(targetX, targetY);
      return;
    }

    if (distance <= stopRadius) {
      this.setVelocity(0, 0);
      this.play(`${this.characterVisualId}-idle`, true);
      return;
    }

    const speedMultiplier = distance > ALLY_CATCHUP_DISTANCE ? 1.45 : 1;
    const speed = baseSpeed * speedMultiplier;
    const velocityX = (dx / distance) * speed;
    const velocityY = (dy / distance) * speed;

    this.setVelocity(velocityX, velocityY);
    this.play(`${this.characterVisualId}-run`, true);

    if (velocityX < -1) {
      this.setFlipX(true);
    } else if (velocityX > 1) {
      this.setFlipX(false);
    }
  }

  private avoidBlockingPlayer(player: Player): void {
    const inFrontOfPlayer = (this.x - player.x) * ((player.body as Phaser.Physics.Arcade.Body | null)?.velocity.x ?? 0) > 0;
    const closeToPlayer = Phaser.Math.Distance.Between(this.x, this.y, player.x, player.y) < ALLY_PLAYER_BLOCK_RADIUS;

    if (inFrontOfPlayer && closeToPlayer) {
      this.setVelocityX(this.body && (this.body as Phaser.Physics.Arcade.Body).velocity.x >= 0 ? -120 : 120);
    }
  }

  private recoverNearPoint(targetX: number, targetY: number): void {
    this.setPosition(targetX - this.profile.followOffsetX * 0.35, targetY - 10);
    this.setVelocity(0, 0);
    this.setAlpha(0.45);

    this.scene.tweens.add({
      targets: this,
      alpha: 0.92,
      duration: 220,
      ease: 'Sine.Out'
    });
  }


  getActiveWeaponRuntime() {
    return this.runtimeConfig.weaponRuntimeBySlot[this.activeWeaponSlot] ?? this.runtimeConfig.weaponRuntimeBySlot.primary ?? this.runtimeConfig.weaponRuntime;
  }

  getCombatActorId(): string {
    return this.profile.id;
  }

  setCombatDirection(direction: 1 | -1): void {
    this.setFlipX(direction < 0);
  }

  playCombatAttackAnimation(): void {
    this.play(`${this.characterVisualId}-shoot`, true);
    this.setTintFill(0xfef08a);
    this.scene.time.delayedCall(90, () => {
      if (this.active) {
        this.setTint(this.profile.tint);
      }
    });
  }

  private tryAttackTarget(target: Zombie): void {
    if (!target.active) {
      return;
    }

    if (this.isReloading) {
      return;
    }

    const direction = target.x >= this.x ? 1 : -1;
    this.setFlipX(direction < 0);

    const activeWeapon = this.getActiveWeaponRuntime();
    const weaponCatalog = getWeaponCatalogEntry(activeWeapon.key);
    if (weaponCatalog.isMelee) {
      this.combatActionSystem.tryStartAllyMeleeAction(this, target);
      return;
    }

    const ammoSnapshot = this.ammoRuntime.getSnapshotForWeapon(activeWeapon.key);
    if (!this.ammoRuntime.canFire(activeWeapon.key)) {
      this.startReloadActiveWeapon(activeWeapon.key);
      return;
    }

    const weaponVisual = getWeaponVisualRuntimeConfig(activeWeapon.key);
    const fired = this.projectileSystem.tryFire({
      originX: this.x + direction * weaponVisual.muzzleOffsetX,
      originY: this.y + weaponVisual.muzzleOffsetY,
      direction,
      weapon: activeWeapon.key,
      shooterId: this.profile.id,
      shooterCharacterId: this.runtimeConfig.characterId,
      activeWeapon: {
        key: activeWeapon.key,
        usesAmmo: ammoSnapshot.usesAmmo,
        ammoCurrent: ammoSnapshot.ammoCurrent
      }
    });

    if (!fired) {
      return;
    }

    this.ammoRuntime.consumeForShot(activeWeapon.key);
    this.playCombatAttackAnimation();
  }

  private startReloadActiveWeapon(weaponKey: string): boolean {
    if (this.isReloading || !this.ammoRuntime.canReload(weaponKey)) {
      return false;
    }

    this.isReloading = true;
    this.reloadingWeaponKey = weaponKey;
    this.reloadEndsAt = this.scene.time.now + Math.max(0, getWeaponCatalogEntry(weaponKey).reloadTimeMs);
    return true;
  }

  private cancelReload(): void {
    this.isReloading = false;
    this.reloadingWeaponKey = undefined;
    this.reloadEndsAt = 0;
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

  private updateCombatLoadout(distanceToTarget: number): void {
    const activeWeapon = this.getActiveWeaponRuntime();
    const activeCatalog = getWeaponCatalogEntry(activeWeapon.key);

    if (activeCatalog.isDefensive && distanceToTarget <= ALLY_DEFENSE_SWITCH_DISTANCE) {
      return;
    }

    if (distanceToTarget <= ALLY_DEFENSE_SWITCH_DISTANCE) {
      const shieldSlot = this.findWeaponSlot((weapon) => weapon.key === 'tray_shield');
      if (shieldSlot) {
        this.switchToSlotAndCancelReload(shieldSlot);
        return;
      }
    }

    if (distanceToTarget <= ALLY_MELEE_SWITCH_DISTANCE) {
      const meleeSlot = this.findWeaponSlot((weapon) => {
        const catalog = getWeaponCatalogEntry(weapon.key);
        return catalog.isMelee && !catalog.isDefensive;
      });
      if (meleeSlot) {
        this.switchToSlotAndCancelReload(meleeSlot);
        return;
      }
    }

    if (this.isReloading && distanceToTarget <= ALLY_MELEE_SWITCH_DISTANCE) {
      const fallbackSlot = this.findWeaponSlot((weapon) => {
        const catalog = getWeaponCatalogEntry(weapon.key);
        if (catalog.isMelee || catalog.isDefensive) {
          return true;
        }

        return this.ammoRuntime.canFire(weapon.key);
      });
      if (fallbackSlot && fallbackSlot !== this.activeWeaponSlot) {
        this.switchToSlotAndCancelReload(fallbackSlot);
        return;
      }
    }

    if (!this.ammoRuntime.canFire(activeWeapon.key)) {
      const slotWithAmmo = this.findWeaponSlot((weapon) => {
        const catalog = getWeaponCatalogEntry(weapon.key);
        if (catalog.isMelee || catalog.isDefensive) {
          return true;
        }

        return this.ammoRuntime.canFire(weapon.key);
      });

      if (slotWithAmmo && slotWithAmmo !== this.activeWeaponSlot) {
        this.switchToSlotAndCancelReload(slotWithAmmo);
        return;
      }

      this.startReloadActiveWeapon(activeWeapon.key);
      return;
    }

    if (!activeCatalog.usesAmmo || activeCatalog.isMelee || activeCatalog.isDefensive || distanceToTarget < ALLY_SAFE_RELOAD_DISTANCE) {
      return;
    }

    const ammo = this.ammoRuntime.getSnapshotForWeapon(activeWeapon.key);
    const ammoCurrent = ammo.ammoCurrent ?? 0;
    const ammoMax = ammo.ammoMax ?? 1;
    const ammoRatio = ammoMax > 0 ? ammoCurrent / ammoMax : 1;

    if (ammoRatio <= ALLY_LOW_AMMO_RATIO) {
      this.startReloadActiveWeapon(activeWeapon.key);
    }
  }

  private switchToSlotAndCancelReload(slot: CharacterWeaponSlot): void {
    if (this.switchActiveWeaponSlot(slot)) {
      this.cancelReload();
    }
  }

  private findWeaponSlot(predicate: (weaponRuntime: ReturnType<AllyAI['getActiveWeaponRuntime']>) => boolean): CharacterWeaponSlot | undefined {
    const slots: CharacterWeaponSlot[] = ['primary', 'secondary'];

    return slots.find((slot) => {
      const runtime = this.runtimeConfig.weaponRuntimeBySlot[slot];
      if (!runtime) {
        return false;
      }

      return predicate(runtime);
    });
  }

  private pickTarget(zombies: Zombie[], player: Player, currentTime: number): Zombie | undefined {
    if (this.currentTargetId?.active) {
      const currentDistance = Phaser.Math.Distance.Between(this.x, this.y, this.currentTargetId.x, this.currentTargetId.y);
      if (currentDistance <= ALLY_TARGET_DETECTION_RANGE + ALLY_TARGET_SWITCH_BIAS) {
        if (currentTime <= this.currentTargetLockedUntil) {
          return this.currentTargetId;
        }
      } else {
        this.currentTargetId = undefined;
      }
    }

    let closestZombie: Zombie | undefined;
    let bestScore = Number.POSITIVE_INFINITY;

    zombies.forEach((zombie) => {
      if (!zombie.active) {
        return;
      }

      const allyDistance = Phaser.Math.Distance.Between(this.x, this.y, zombie.x, zombie.y);
      if (allyDistance > ALLY_TARGET_DETECTION_RANGE) {
        return;
      }

      const playerDistance = Phaser.Math.Distance.Between(player.x, player.y, zombie.x, zombie.y);
      const score = allyDistance * 0.72 + playerDistance * 0.28;

      if (score < bestScore) {
        bestScore = score;
        closestZombie = zombie;
      }
    });

    if (closestZombie) {
      this.currentTargetId = closestZombie;
      this.currentTargetLockedUntil = currentTime + ALLY_TARGET_MEMORY_MS;
    }

    return closestZombie;
  }

  private getCombatAnchor(player: Player, target: Zombie): { x: number; y: number } {
    const lateralSign = this.profile.followOffsetX >= 0 ? 1 : -1;
    const targetToPlayerDirection = Math.sign(player.x - target.x) || -lateralSign;
    const desiredX = target.x + targetToPlayerDirection * ALLY_COMBAT_REPOSITION_DISTANCE + lateralSign * 26;
    const desiredY = target.y + this.profile.followOffsetY * 0.35;

    return { x: desiredX, y: desiredY };
  }

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);
    this.nameTag.setPosition(this.x, this.y - 42);
    this.nameTag.setVisible(this.active && this.isNameTagVisible);
  }

  destroy(fromScene?: boolean): void {
    this.nameTag.destroy();
    super.destroy(fromScene);
  }
}
