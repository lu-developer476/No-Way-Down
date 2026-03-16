import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { AllyAI } from '../entities/AllyAI';
import { Zombie } from '../entities/Zombie';
import { getWeaponCatalogEntry } from '../config/weaponCatalog';
import { getWeaponRuntimeConfig } from '../config/weaponRuntime';

interface MeleeSwingRuntime {
  actorId: string;
  actor: Player | AllyAI;
  direction: 1 | -1;
  weaponKey: string;
  damage: number;
  range: number;
  hitboxHeight: number;
  endsAt: number;
  hitTargets: Set<Zombie>;
}

export class CombatActionSystem {
  private readonly scene: Phaser.Scene;
  private readonly cooldownUntilByActorId = new Map<string, number>();
  private readonly activeSwings: MeleeSwingRuntime[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  update(players: Player[], allies: AllyAI[], zombies: Zombie[]): void {
    players.forEach((player) => this.updatePlayerDefenseState(player));
    this.updateActiveSwings(zombies);
    this.cleanupInactiveActors(players, allies);
  }

  tryStartPlayerMeleeAction(player: Player): boolean {
    if (!player.active || player.isDead()) {
      return false;
    }

    if (!player.consumeAttackRequest()) {
      return false;
    }

    const weaponRuntime = player.getActiveWeaponRuntime();
    const weaponCatalog = getWeaponCatalogEntry(weaponRuntime.key);
    if (!weaponCatalog.isMelee || weaponCatalog.isDefensive) {
      return false;
    }

    return this.tryStartMeleeSwing({
      actorId: player.getCombatActorId(),
      actor: player,
      direction: player.getLookDirection(),
      weaponKey: weaponRuntime.key
    });
  }

  tryStartAllyMeleeAction(ally: AllyAI, target: Zombie): boolean {
    if (!ally.active || !target.active) {
      return false;
    }

    const weaponRuntime = ally.getActiveWeaponRuntime();
    const weaponCatalog = getWeaponCatalogEntry(weaponRuntime.key);
    if (!weaponCatalog.isMelee) {
      return false;
    }

    const direction: 1 | -1 = target.x >= ally.x ? 1 : -1;
    ally.setCombatDirection(direction);

    return this.tryStartMeleeSwing({
      actorId: ally.getCombatActorId(),
      actor: ally,
      direction,
      weaponKey: weaponRuntime.key
    });
  }

  private updatePlayerDefenseState(player: Player): void {
    const weaponRuntime = player.getActiveWeaponRuntime();
    const weaponCatalog = getWeaponCatalogEntry(weaponRuntime.key);
    const canDefend = weaponCatalog.isDefensive && player.isAttackHeld();

    player.setDefensiveState(canDefend, {
      mitigationRatio: weaponRuntime.defenseMitigationRatio,
      frontalOnly: weaponRuntime.defenseFrontalOnly
    });
  }

  private tryStartMeleeSwing(config: {
    actorId: string;
    actor: Player | AllyAI;
    direction: 1 | -1;
    weaponKey: string;
  }): boolean {
    const now = this.scene.time.now;
    const runtime = getWeaponRuntimeConfig(config.weaponKey);
    const nextAllowedAttackAt = this.cooldownUntilByActorId.get(config.actorId) ?? 0;

    if (now < nextAllowedAttackAt || runtime.meleeHitboxDurationMs <= 0 || runtime.meleeContactDamage <= 0) {
      return false;
    }

    this.cooldownUntilByActorId.set(config.actorId, now + Math.max(runtime.fireCooldownMs, runtime.meleeHitboxDurationMs));

    this.activeSwings.push({
      actorId: config.actorId,
      actor: config.actor,
      direction: config.direction,
      weaponKey: config.weaponKey,
      damage: runtime.meleeContactDamage,
      range: runtime.maxRange,
      hitboxHeight: runtime.meleeHitboxHeight,
      endsAt: now + runtime.meleeHitboxDurationMs,
      hitTargets: new Set<Zombie>()
    });

    config.actor.playCombatAttackAnimation();
    return true;
  }

  private updateActiveSwings(zombies: Zombie[]): void {
    const now = this.scene.time.now;

    for (let index = this.activeSwings.length - 1; index >= 0; index -= 1) {
      const swing = this.activeSwings[index];
      if (now > swing.endsAt || !swing.actor.active) {
        this.activeSwings.splice(index, 1);
        continue;
      }

      const actorCenterY = swing.actor.y - 12;
      const halfHeight = Math.max(20, swing.hitboxHeight / 2);
      const hitboxStartX = swing.direction > 0 ? swing.actor.x : swing.actor.x - swing.range;
      const hitboxEndX = swing.direction > 0 ? swing.actor.x + swing.range : swing.actor.x;

      zombies.forEach((zombie) => {
        if (!zombie.active || swing.hitTargets.has(zombie)) {
          return;
        }

        const inHorizontalRange = zombie.x >= hitboxStartX && zombie.x <= hitboxEndX;
        const inVerticalRange = zombie.y >= actorCenterY - halfHeight && zombie.y <= actorCenterY + halfHeight;

        if (!inHorizontalRange || !inVerticalRange) {
          return;
        }

        zombie.takeDamage(swing.damage);
        swing.hitTargets.add(zombie);
      });
    }
  }

  private cleanupInactiveActors(players: Player[], allies: AllyAI[]): void {
    const activeActorIds = new Set<string>([
      ...players.filter((player) => player.active).map((player) => player.getCombatActorId()),
      ...allies.filter((ally) => ally.active).map((ally) => ally.getCombatActorId())
    ]);

    Array.from(this.cooldownUntilByActorId.keys()).forEach((actorId) => {
      if (!activeActorIds.has(actorId)) {
        this.cooldownUntilByActorId.delete(actorId);
      }
    });
  }
}
