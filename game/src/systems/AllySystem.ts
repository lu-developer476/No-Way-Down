import Phaser from 'phaser';
import { AllyAI, AllyProfile } from '../entities/AllyAI';
import { Player } from '../entities/Player';
import { Zombie } from '../entities/Zombie';
import { AllySeedConfig } from '../config/localMultiplayer';
import { ProjectileSystem } from './ProjectileSystem';
import { CombatActionSystem } from './CombatActionSystem';

const DEFAULT_LANE_OFFSETS_X = [-74, 74, -118, 118, -154, 154, -190, 190];
const DEFAULT_LANE_OFFSETS_Y = [-8, -12, -8, -12, -4, -8, -4, -8];

export class AllySystem {
  private readonly scene: Phaser.Scene;
  private readonly allies: Phaser.Physics.Arcade.Group;
  private readonly projectileSystem: ProjectileSystem;
  private readonly combatActionSystem: CombatActionSystem;

  constructor(scene: Phaser.Scene, projectileSystem: ProjectileSystem, combatActionSystem: CombatActionSystem, maxAllies = 8) {
    this.scene = scene;
    this.projectileSystem = projectileSystem;
    this.combatActionSystem = combatActionSystem;
    this.allies = this.scene.physics.add.group({
      classType: AllyAI,
      maxSize: maxAllies,
      runChildUpdate: false
    });
  }

  spawnInitialAllies(player: Player, seedAllies: AllySeedConfig[]): void {
    seedAllies.forEach((seed, index) => {
      const profile: AllyProfile = {
        ...seed,
        followOffsetX: DEFAULT_LANE_OFFSETS_X[index] ?? -72,
        followOffsetY: DEFAULT_LANE_OFFSETS_Y[index] ?? -8
      };
      this.spawnAtPlayer(profile, player);
    });
  }

  spawnRescuedAlly(profile: AllyProfile, player: Player): AllyAI | null {
    return this.spawnAtPlayer(profile, player);
  }

  createEnvironmentColliders(ground: Phaser.Physics.Arcade.StaticGroup): void {
    this.scene.physics.add.collider(this.allies, ground);
  }

  createZombieOverlap(zombieGroup: Phaser.Physics.Arcade.Group): void {
    this.scene.physics.add.overlap(this.allies, zombieGroup);
  }

  update(player: Player, zombies: Zombie[], currentTime: number): void {
    this.allies.children.each((child) => {
      const ally = child as AllyAI;
      if (ally.active) {
        ally.updateAI(player, zombies, currentTime);
      }

      return true;
    });
  }

  getActiveAllies(): AllyAI[] {
    return this.allies.getChildren()
      .map((child) => child as AllyAI)
      .filter((ally) => ally.active);
  }

  private spawnAtPlayer(profile: AllyProfile, player: Player): AllyAI | null {
    const ally = new AllyAI(this.scene, player.x + profile.followOffsetX, player.y + profile.followOffsetY, profile, this.projectileSystem, this.combatActionSystem);
    this.allies.add(ally);
    return ally;
  }
}
