import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Zombie } from '../entities/Zombie';
import { ZombieSystem } from './ZombieSystem';

export type LandingZoneType = 'rest' | 'combat' | 'checkpoint';

export interface LandingZoneBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LandingZoneCheckpointConfig {
  id: string;
  x: number;
  y: number;
  saveOnce?: boolean;
}

export interface LandingZoneCombatConfig {
  spawnPoints: Array<{ x: number; y: number }>;
  zombiesPerWave: number;
  waves: number;
}

export interface LandingZoneConfig {
  id: string;
  type: LandingZoneType;
  bounds: LandingZoneBounds;
  label?: string;
  repeatable?: boolean;
  checkpoint?: LandingZoneCheckpointConfig;
  combat?: LandingZoneCombatConfig;
}

export interface LandingZoneSystemConfig {
  players: Player[];
  zones: LandingZoneConfig[];
  zombieSystem?: ZombieSystem;
  debug?: boolean;
  onRestZoneEntered?: (zone: LandingZoneConfig) => void;
  onCombatStarted?: (zone: LandingZoneConfig) => void;
  onCombatCompleted?: (zone: LandingZoneConfig) => void;
  onCheckpointReached?: (zone: LandingZoneConfig, checkpoint: LandingZoneCheckpointConfig) => void;
}

interface LandingZoneRuntime {
  config: LandingZoneConfig;
  trigger: Phaser.GameObjects.Zone;
  state: 'idle' | 'active' | 'completed';
  completedCombatWaves: number;
  activeZombies: Zombie[];
  checkpointSaved: boolean;
}

export interface LandingZonesJsonConfig {
  rellanos: Array<{
    id: string;
    tipo: LandingZoneType;
    area: LandingZoneBounds;
    etiqueta?: string;
    repetible?: boolean;
    checkpoint?: LandingZoneCheckpointConfig;
    combate?: {
      spawnPoints: Array<{ x: number; y: number }>;
      zombiesPorOleada: number;
      oleadas: number;
    };
  }>;
}

export function createLandingZonesFromJson(levelJson: LandingZonesJsonConfig): LandingZoneConfig[] {
  return levelJson.rellanos.map((landingZone) => ({
    id: landingZone.id,
    type: landingZone.tipo,
    bounds: landingZone.area,
    label: landingZone.etiqueta,
    repeatable: landingZone.repetible,
    checkpoint: landingZone.checkpoint,
    combat: landingZone.combate
      ? {
          spawnPoints: landingZone.combate.spawnPoints,
          zombiesPerWave: landingZone.combate.zombiesPorOleada,
          waves: landingZone.combate.oleadas
        }
      : undefined
  }));
}

export class LandingZoneSystem {
  private readonly scene: Phaser.Scene;
  private readonly players: Player[];
  private readonly zombieSystem?: ZombieSystem;
  private readonly debug: boolean;
  private readonly onRestZoneEntered?: (zone: LandingZoneConfig) => void;
  private readonly onCombatStarted?: (zone: LandingZoneConfig) => void;
  private readonly onCombatCompleted?: (zone: LandingZoneConfig) => void;
  private readonly onCheckpointReached?: (zone: LandingZoneConfig, checkpoint: LandingZoneCheckpointConfig) => void;
  private readonly zones: LandingZoneRuntime[];

  constructor(scene: Phaser.Scene, config: LandingZoneSystemConfig) {
    this.scene = scene;
    this.players = config.players;
    this.zombieSystem = config.zombieSystem;
    this.debug = config.debug ?? false;
    this.onRestZoneEntered = config.onRestZoneEntered;
    this.onCombatStarted = config.onCombatStarted;
    this.onCombatCompleted = config.onCombatCompleted;
    this.onCheckpointReached = config.onCheckpointReached;
    this.zones = config.zones.map((zoneConfig) => this.createZoneRuntime(zoneConfig));

    this.bindOverlaps();
  }

  update(): void {
    this.zones.forEach((zone) => {
      if (zone.config.type !== 'combat' || zone.state !== 'active') {
        return;
      }

      zone.activeZombies = zone.activeZombies.filter((zombie) => zombie.active);
      if (zone.activeZombies.length > 0) {
        return;
      }

      const combatConfig = zone.config.combat;
      if (!combatConfig) {
        this.finishZone(zone);
        return;
      }

      zone.completedCombatWaves += 1;

      if (zone.completedCombatWaves >= combatConfig.waves) {
        this.finishZone(zone);
        return;
      }

      zone.activeZombies = this.spawnCombatWave(zone);
      this.scene.registry.set(
        'interactionHint',
        `${zone.config.label ?? zone.config.id}: oleada ${zone.completedCombatWaves + 1}/${combatConfig.waves}`
      );
    });
  }

  getZoneState(zoneId: string): 'idle' | 'active' | 'completed' | undefined {
    return this.zones.find((zone) => zone.config.id === zoneId)?.state;
  }

  private createZoneRuntime(config: LandingZoneConfig): LandingZoneRuntime {
    this.validateZoneConfig(config);

    const trigger = this.scene.add.zone(config.bounds.x, config.bounds.y, config.bounds.width, config.bounds.height);
    this.scene.physics.add.existing(trigger, true);

    if (this.debug) {
      this.scene.add.rectangle(config.bounds.x, config.bounds.y, config.bounds.width, config.bounds.height, 0x22d3ee, 0.08)
        .setDepth(1000);
    }

    return {
      config,
      trigger,
      state: 'idle',
      completedCombatWaves: 0,
      activeZombies: [],
      checkpointSaved: false
    };
  }

  private bindOverlaps(): void {
    this.zones.forEach((zone) => {
      this.players.forEach((player) => {
        this.scene.physics.add.overlap(player, zone.trigger, () => this.handleZoneEnter(zone));
      });
    });
  }

  private handleZoneEnter(zone: LandingZoneRuntime): void {
    if (zone.state === 'completed' && !zone.config.repeatable) {
      return;
    }

    if (zone.state === 'active') {
      return;
    }

    switch (zone.config.type) {
      case 'rest':
        this.onRestZoneEntered?.(zone.config);
        this.scene.registry.set('interactionHint', zone.config.label ?? `Rellano ${zone.config.id}: zona segura`);
        this.completeImmediately(zone);
        break;
      case 'checkpoint':
        this.triggerCheckpoint(zone);
        this.completeImmediately(zone);
        break;
      case 'combat':
        this.activateCombatZone(zone);
        break;
      default:
        break;
    }
  }

  private triggerCheckpoint(zone: LandingZoneRuntime): void {
    if (!zone.config.checkpoint) {
      return;
    }

    if (zone.config.checkpoint.saveOnce !== false && zone.checkpointSaved) {
      return;
    }

    zone.checkpointSaved = true;
    this.onCheckpointReached?.(zone.config, zone.config.checkpoint);
    this.scene.registry.set('interactionHint', zone.config.label ?? `Checkpoint ${zone.config.checkpoint.id} guardado`);
  }

  private activateCombatZone(zone: LandingZoneRuntime): void {
    zone.state = 'active';
    zone.completedCombatWaves = 0;
    zone.activeZombies = this.spawnCombatWave(zone);

    this.onCombatStarted?.(zone.config);
    this.scene.registry.set('interactionHint', zone.config.label ?? `Rellano ${zone.config.id}: combate iniciado`);

    if (zone.activeZombies.length === 0) {
      this.finishZone(zone);
    }
  }

  private spawnCombatWave(zone: LandingZoneRuntime): Zombie[] {
    const combatConfig = zone.config.combat;
    if (!combatConfig || !this.zombieSystem) {
      return [];
    }

    const waveZombies: Zombie[] = [];

    for (let i = 0; i < combatConfig.zombiesPerWave; i += 1) {
      const spawnPoint = combatConfig.spawnPoints[i % combatConfig.spawnPoints.length];
      const zombie = this.zombieSystem.spawn(spawnPoint.x, spawnPoint.y);
      if (zombie) {
        waveZombies.push(zombie);
      }
    }

    return waveZombies;
  }

  private finishZone(zone: LandingZoneRuntime): void {
    zone.state = 'completed';
    zone.activeZombies = [];
    this.onCombatCompleted?.(zone.config);
    this.scene.registry.set('interactionHint', zone.config.label ?? `Rellano ${zone.config.id} despejado`);

    if (zone.config.repeatable) {
      zone.state = 'idle';
      zone.completedCombatWaves = 0;
    }
  }

  private completeImmediately(zone: LandingZoneRuntime): void {
    if (zone.config.repeatable) {
      zone.state = 'idle';
      return;
    }

    zone.state = 'completed';
    this.disableZoneTrigger(zone);
  }

  private disableZoneTrigger(zone: LandingZoneRuntime): void {
    zone.trigger.setActive(false).setVisible(false);
    const body = zone.trigger.body as Phaser.Physics.Arcade.StaticBody;
    body.enable = false;
  }

  private validateZoneConfig(config: LandingZoneConfig): void {
    if (config.type === 'combat') {
      if (!config.combat) {
        throw new Error(`Landing zone "${config.id}" is combat but has no combat config.`);
      }

      if (config.combat.spawnPoints.length === 0) {
        throw new Error(`Landing zone "${config.id}" must have at least one spawn point.`);
      }

      if (config.combat.waves < 1 || config.combat.zombiesPerWave < 1) {
        throw new Error(`Landing zone "${config.id}" has invalid wave values.`);
      }
    }

    if (config.type === 'checkpoint' && !config.checkpoint) {
      throw new Error(`Landing zone "${config.id}" is checkpoint but has no checkpoint config.`);
    }
  }
}
