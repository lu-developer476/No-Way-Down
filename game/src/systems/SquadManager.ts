import Phaser from 'phaser';
import { Survivor } from '../entities/Survivor';
import { Zombie } from '../entities/Zombie';

export interface SquadManagerConfig {
  readonly searchRadius?: number;
  readonly maxSimultaneousShots?: number;
  readonly volleyCooldownMs?: number;
  readonly minimumShooterSpacing?: number;
}

interface ShotOrder {
  readonly survivor: Survivor;
  readonly zombie: Zombie;
  readonly distanceSq: number;
  readonly cooldownRemaining: number;
}

const DEFAULT_SEARCH_RADIUS = 280;
const DEFAULT_MAX_SIMULTANEOUS_SHOTS = 2;
const DEFAULT_VOLLEY_COOLDOWN_MS = 120;
const DEFAULT_MINIMUM_SHOOTER_SPACING = 24;

export class SquadManager {
  private readonly searchRadiusSq: number;
  private readonly maxSimultaneousShots: number;
  private readonly volleyCooldownMs: number;
  private readonly minimumShooterSpacingSq: number;

  private nextVolleyAt = 0;
  private survivors: Survivor[] = [];

  constructor(config: SquadManagerConfig = {}) {
    const searchRadius = Math.max(1, config.searchRadius ?? DEFAULT_SEARCH_RADIUS);
    this.searchRadiusSq = searchRadius * searchRadius;
    this.maxSimultaneousShots = Math.max(1, Math.floor(config.maxSimultaneousShots ?? DEFAULT_MAX_SIMULTANEOUS_SHOTS));
    this.volleyCooldownMs = Math.max(0, Math.floor(config.volleyCooldownMs ?? DEFAULT_VOLLEY_COOLDOWN_MS));

    const minimumShooterSpacing = Math.max(0, config.minimumShooterSpacing ?? DEFAULT_MINIMUM_SHOOTER_SPACING);
    this.minimumShooterSpacingSq = minimumShooterSpacing * minimumShooterSpacing;
  }

  addMember(member: Survivor): void {
    if (!member.active || this.survivors.includes(member)) {
      return;
    }

    this.survivors.push(member);
  }

  removeMember(member: Survivor | string): void {
    this.survivors = this.survivors.filter((survivor) => {
      if (typeof member === 'string') {
        return survivor.id !== member;
      }

      return survivor !== member;
    });
  }

  update(zombies: readonly Zombie[], currentTime: number): void {
    this.cleanupDeadMembers();

    if (this.survivors.length === 0 || currentTime < this.nextVolleyAt) {
      return;
    }

    const shotOrders = this.buildShotOrders(zombies, currentTime);
    if (shotOrders.length === 0) {
      return;
    }

    const selectedShooters: Survivor[] = [];
    let firedShots = 0;

    for (const order of shotOrders) {
      if (firedShots >= this.maxSimultaneousShots) {
        break;
      }

      if (!this.hasShooterSpacing(order.survivor, selectedShooters)) {
        continue;
      }

      const didShoot = order.survivor.attack(order.zombie.x, order.zombie.y, currentTime);
      if (!didShoot) {
        continue;
      }

      selectedShooters.push(order.survivor);
      firedShots += 1;
    }

    if (firedShots > 0) {
      this.nextVolleyAt = currentTime + this.volleyCooldownMs;
    }
  }

  private buildShotOrders(zombies: readonly Zombie[], currentTime: number): ShotOrder[] {
    const activeZombies = zombies.filter((zombie) => zombie.active);
    if (activeZombies.length === 0) {
      return [];
    }

    const orders: ShotOrder[] = [];

    this.survivors.forEach((survivor) => {
      let nearestZombie: Zombie | null = null;
      let nearestDistanceSq = Number.POSITIVE_INFINITY;

      activeZombies.forEach((zombie) => {
        const distanceSq = Phaser.Math.Distance.Squared(survivor.x, survivor.y, zombie.x, zombie.y);
        if (distanceSq > this.searchRadiusSq || distanceSq >= nearestDistanceSq) {
          return;
        }

        nearestZombie = zombie;
        nearestDistanceSq = distanceSq;
      });

      if (!nearestZombie) {
        return;
      }

      orders.push({
        survivor,
        zombie: nearestZombie,
        distanceSq: nearestDistanceSq,
        cooldownRemaining: survivor.getShotCooldownRemaining(currentTime)
      });
    });

    return orders.sort((a, b) => {
      if (a.cooldownRemaining !== b.cooldownRemaining) {
        return a.cooldownRemaining - b.cooldownRemaining;
      }

      return a.distanceSq - b.distanceSq;
    });
  }

  private hasShooterSpacing(candidate: Survivor, selectedShooters: readonly Survivor[]): boolean {
    return selectedShooters.every((selected) => {
      const distanceSq = Phaser.Math.Distance.Squared(candidate.x, candidate.y, selected.x, selected.y);
      return distanceSq >= this.minimumShooterSpacingSq;
    });
  }

  private cleanupDeadMembers(): void {
    this.survivors = this.survivors.filter((survivor) => survivor.active && survivor.health > 0);
  }
}
