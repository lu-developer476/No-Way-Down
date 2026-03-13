import Phaser from 'phaser';
import { AllyAI, AllyProfile } from '../entities/AllyAI';
import { Player } from '../entities/Player';
import { Zombie } from '../entities/Zombie';

const INITIAL_ALLY_PROFILES: AllyProfile[] = [
  {
    id: 'ally-alpha',
    name: 'Ally Alpha',
    followOffsetX: -70,
    tint: 0x93c5fd
  },
  {
    id: 'ally-bravo',
    name: 'Ally Bravo',
    followOffsetX: 70,
    tint: 0xa7f3d0
  }
];

export class AllySystem {
  private readonly scene: Phaser.Scene;
  private readonly allies: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene, maxAllies = 8) {
    this.scene = scene;
    this.allies = this.scene.physics.add.group({
      classType: AllyAI,
      maxSize: maxAllies,
      runChildUpdate: false
    });
  }

  spawnInitialAllies(player: Player): void {
    INITIAL_ALLY_PROFILES.forEach((profile) => {
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

  private spawnAtPlayer(profile: AllyProfile, player: Player): AllyAI | null {
    const ally = new AllyAI(this.scene, player.x + profile.followOffsetX, player.y - 12, profile);
    this.allies.add(ally);
    return ally;
  }
}
