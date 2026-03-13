import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ZombieSystem } from '../systems/ZombieSystem';
import { LandingZoneSystem, LandingZonesJsonConfig, createLandingZonesFromJson } from '../systems/LandingZoneSystem';
import landingZonesJson from '../../public/assets/levels/level4_landing_zones.json';

export function buildLandingZoneSystemExample(
  scene: Phaser.Scene,
  players: Player[],
  zombieSystem: ZombieSystem,
  saveCheckpoint: (id: string, x: number, y: number) => void
): LandingZoneSystem {
  const zones = createLandingZonesFromJson(landingZonesJson as LandingZonesJsonConfig);

  return new LandingZoneSystem(scene, {
    players,
    zombieSystem,
    zones,
    onRestZoneEntered: (zone) => {
      scene.registry.set('interactionHint', `${zone.label ?? zone.id}: recupera recursos y sigue subiendo`);
    },
    onCombatStarted: (zone) => {
      scene.registry.set('interactionHint', `${zone.label ?? zone.id}: resiste las oleadas`);
    },
    onCombatCompleted: (zone) => {
      scene.registry.set('interactionHint', `${zone.label ?? zone.id}: rellano asegurado`);
    },
    onCheckpointReached: (_zone, checkpoint) => {
      saveCheckpoint(checkpoint.id, checkpoint.x, checkpoint.y);
    }
  });
}
