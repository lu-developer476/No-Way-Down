import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Zombie } from '../entities/Zombie';
import { ZombieSystem } from './ZombieSystem';

export type HallCombatZoneId = 'zona-1-entrada' | 'zona-2-central' | 'zona-3-mostradores' | 'zona-4-salida';

export interface HallSpawnPoint {
  x: number;
  y: number;
}

export interface HallCombatZoneConfig {
  id: HallCombatZoneId;
  displayName: string;
  trigger: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  blockers: {
    back: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    front: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
  zombieSpawns: HallSpawnPoint[];
  zombieCount: number;
}

type ZoneState = 'idle' | 'active' | 'completed';

interface RuntimeHallZone {
  config: HallCombatZoneConfig;
  trigger: Phaser.GameObjects.Zone;
  backBlocker: Phaser.GameObjects.Rectangle;
  frontBlocker: Phaser.GameObjects.Rectangle;
  spawnedZombies: Zombie[];
  state: ZoneState;
}

export function createDefaultHallCombatZones(levelHeight: number): HallCombatZoneConfig[] {
  const centerY = levelHeight - 150;
  const blockerHeight = levelHeight;

  return [
    {
      id: 'zona-1-entrada',
      displayName: 'Zona 1: entrada al hall',
      trigger: { x: 520, y: centerY, width: 180, height: 220 },
      blockers: {
        back: { x: 360, y: levelHeight / 2, width: 24, height: blockerHeight },
        front: { x: 760, y: levelHeight / 2, width: 24, height: blockerHeight }
      },
      zombieSpawns: [
        { x: 410, y: centerY },
        { x: 480, y: centerY },
        { x: 620, y: centerY },
        { x: 690, y: centerY }
      ],
      zombieCount: 6
    },
    {
      id: 'zona-2-central',
      displayName: 'Zona 2: sector central',
      trigger: { x: 1080, y: centerY, width: 210, height: 230 },
      blockers: {
        back: { x: 860, y: levelHeight / 2, width: 24, height: blockerHeight },
        front: { x: 1290, y: levelHeight / 2, width: 24, height: blockerHeight }
      },
      zombieSpawns: [
        { x: 930, y: centerY },
        { x: 1010, y: centerY - 20 },
        { x: 1140, y: centerY + 10 },
        { x: 1230, y: centerY }
      ],
      zombieCount: 8
    },
    {
      id: 'zona-3-mostradores',
      displayName: 'Zona 3: mostradores',
      trigger: { x: 1580, y: centerY, width: 200, height: 220 },
      blockers: {
        back: { x: 1380, y: levelHeight / 2, width: 24, height: blockerHeight },
        front: { x: 1780, y: levelHeight / 2, width: 24, height: blockerHeight }
      },
      zombieSpawns: [
        { x: 1450, y: centerY + 4 },
        { x: 1530, y: centerY - 18 },
        { x: 1650, y: centerY - 8 },
        { x: 1710, y: centerY + 10 }
      ],
      zombieCount: 8
    },
    {
      id: 'zona-4-salida',
      displayName: 'Zona 4: salida',
      trigger: { x: 2040, y: centerY, width: 190, height: 220 },
      blockers: {
        back: { x: 1860, y: levelHeight / 2, width: 24, height: blockerHeight },
        front: { x: 2190, y: levelHeight / 2, width: 24, height: blockerHeight }
      },
      zombieSpawns: [
        { x: 1910, y: centerY },
        { x: 1980, y: centerY - 12 },
        { x: 2080, y: centerY + 6 },
        { x: 2140, y: centerY - 8 }
      ],
      zombieCount: 10
    }
  ];
}

export class HallCombatSystem {
  private readonly scene: Phaser.Scene;
  private readonly zombieSystem: ZombieSystem;
  private readonly players: Player[];
  private readonly zones: RuntimeHallZone[];

  constructor(scene: Phaser.Scene, zombieSystem: ZombieSystem, players: Player[], zoneConfigs: HallCombatZoneConfig[]) {
    this.scene = scene;
    this.zombieSystem = zombieSystem;
    this.players = players;
    this.zones = zoneConfigs.map((zoneConfig) => this.createRuntimeZone(zoneConfig));

    this.bindZoneTriggers();
  }

  update(): void {
    this.zones.forEach((zone) => {
      if (zone.state !== 'active') {
        return;
      }

      const hasAliveZombies = zone.spawnedZombies.some((zombie) => zombie.active);
      if (!hasAliveZombies) {
        this.completeZone(zone);
      }
    });
  }

  getCompletedZonesCount(): number {
    return this.zones.filter((zone) => zone.state === 'completed').length;
  }

  areAllZonesCompleted(): boolean {
    return this.zones.length > 0 && this.getCompletedZonesCount() === this.zones.length;
  }

  private createRuntimeZone(zoneConfig: HallCombatZoneConfig): RuntimeHallZone {
    const trigger = this.scene.add.zone(
      zoneConfig.trigger.x,
      zoneConfig.trigger.y,
      zoneConfig.trigger.width,
      zoneConfig.trigger.height
    );
    this.scene.physics.add.existing(trigger, true);

    const backBlocker = this.createBlocker(zoneConfig.blockers.back);
    const frontBlocker = this.createBlocker(zoneConfig.blockers.front);

    this.setBlockerEnabled(backBlocker, false);
    this.setBlockerEnabled(frontBlocker, false);

    return {
      config: zoneConfig,
      trigger,
      backBlocker,
      frontBlocker,
      spawnedZombies: [],
      state: 'idle'
    };
  }

  private createBlocker(bounds: { x: number; y: number; width: number; height: number }): Phaser.GameObjects.Rectangle {
    const blocker = this.scene.add.rectangle(bounds.x, bounds.y, bounds.width, bounds.height, 0xf97316, 0.12);
    blocker.setVisible(false);
    this.scene.physics.add.existing(blocker, true);

    this.players.forEach((player) => {
      this.scene.physics.add.collider(player, blocker);
    });

    return blocker;
  }

  private bindZoneTriggers(): void {
    this.zones.forEach((zone) => {
      this.players.forEach((player) => {
        this.scene.physics.add.overlap(player, zone.trigger, () => {
          this.activateZone(zone);
        });
      });
    });
  }

  private activateZone(zone: RuntimeHallZone): void {
    if (zone.state !== 'idle') {
      return;
    }

    zone.state = 'active';
    this.setBlockerEnabled(zone.backBlocker, true);
    this.setBlockerEnabled(zone.frontBlocker, true);

    zone.trigger.setActive(false).setVisible(false);
    const triggerBody = zone.trigger.body as Phaser.Physics.Arcade.StaticBody;
    triggerBody.enable = false;

    zone.spawnedZombies = this.spawnZoneZombies(zone.config);
    this.scene.registry.set('interactionHint', `${zone.config.displayName} activa: elimina a todos los zombies.`);
  }

  private spawnZoneZombies(zoneConfig: HallCombatZoneConfig): Zombie[] {
    const spawnedZombies: Zombie[] = [];

    for (let index = 0; index < zoneConfig.zombieCount; index += 1) {
      const spawnPoint = zoneConfig.zombieSpawns[index % zoneConfig.zombieSpawns.length];
      const zombie = this.zombieSystem.spawn(spawnPoint.x, spawnPoint.y);

      if (zombie) {
        spawnedZombies.push(zombie);
      }
    }

    return spawnedZombies;
  }

  private completeZone(zone: RuntimeHallZone): void {
    zone.state = 'completed';
    this.setBlockerEnabled(zone.backBlocker, false);
    this.setBlockerEnabled(zone.frontBlocker, false);

    const isLastZone = this.getCompletedZonesCount() === this.zones.length;
    this.scene.registry.set(
      'interactionHint',
      isLastZone ? 'Hall despejado. Salida habilitada.' : `${zone.config.displayName} despejada. Avanza a la siguiente zona.`
    );
  }

  private setBlockerEnabled(blocker: Phaser.GameObjects.Rectangle, enabled: boolean): void {
    blocker.setVisible(enabled);

    const body = blocker.body as Phaser.Physics.Arcade.StaticBody;
    body.enable = enabled;

    if (enabled) {
      body.updateFromGameObject();
    }
  }
}
