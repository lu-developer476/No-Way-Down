import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { AllyAI } from '../entities/AllyAI';
import { visualTheme } from '../scenes/visualTheme';

export type PickupType =
  | 'food_small'
  | 'food_medium'
  | 'food_large'
  | 'medkit_small'
  | 'medkit_medium'
  | 'medkit_large'
  | 'ammo_pistol'
  | 'ammo_revolver'
  | 'ammo_smg'
  | 'ammo_shotgun'
  | 'ammo_carbine'
  | 'ammo_sniper_rifle'
  | 'ammo_light_machine_gun';

export interface PickupDefinition {
  id: string;
  type: PickupType;
  x: number;
  y: number;
  label?: string;
  interactionRadius?: number;
}

export interface PickupSystemConfig {
  pickups: PickupDefinition[];
}

interface PickupDefinitionRaw {
  id?: string;
  type?: string;
  x?: number;
  y?: number;
  label?: string;
  interactionRadius?: number;
}

interface PickupSystemConfigRaw {
  pickups?: PickupDefinitionRaw[];
}

export interface PickupRewardDefinition {
  type: PickupType;
  x: number;
  y: number;
  label?: string;
}

interface PickupRuntime {
  definition: PickupDefinition;
  consumed: boolean;
  marker: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
}

type PickupConsumer = Player | AllyAI;

const DEFAULT_INTERACTION_RADIUS = 56;

const HEALTH_RESTORE_BY_PICKUP: Record<Extract<PickupType, `food_${string}` | `medkit_${string}`>, number> = {
  food_small: 14,
  food_medium: 28,
  food_large: 42,
  medkit_small: 28,
  medkit_medium: 52,
  medkit_large: 80
};

const AMMO_REWARD_BY_PICKUP: Record<Extract<PickupType, `ammo_${string}`>, { ammoType: string; amount: number }> = {
  ammo_pistol: { ammoType: '9mm', amount: 24 },
  ammo_revolver: { ammoType: '.357', amount: 12 },
  ammo_smg: { ammoType: '9mm', amount: 45 },
  ammo_shotgun: { ammoType: '12g', amount: 16 },
  ammo_carbine: { ammoType: '5.56', amount: 40 },
  ammo_sniper_rifle: { ammoType: '7.62', amount: 15 },
  ammo_light_machine_gun: { ammoType: '5.56', amount: 60 }
};

function isHealthPickup(type: PickupType): type is Extract<PickupType, `food_${string}` | `medkit_${string}`> {
  return type.startsWith('food_') || type.startsWith('medkit_');
}

function isAmmoPickup(type: PickupType): type is Extract<PickupType, `ammo_${string}`> {
  return type.startsWith('ammo_');
}

function getDisplayLabel(definition: Pick<PickupDefinition, 'type' | 'label'>): string {
  if (definition.label) {
    return definition.label;
  }

  const labelByType: Record<PickupType, string> = {
    food_small: 'Snack',
    food_medium: 'Comida',
    food_large: 'Raciones',
    medkit_small: 'Botiquín chico',
    medkit_medium: 'Botiquín',
    medkit_large: 'Botiquín grande',
    ammo_pistol: 'Munición 9 mm',
    ammo_revolver: 'Munición .357',
    ammo_smg: 'Munición SMG',
    ammo_shotgun: 'Cartuchos 12 g',
    ammo_carbine: 'Munición 5.56',
    ammo_sniper_rifle: 'Munición 7.62',
    ammo_light_machine_gun: 'Munición ametralladora'
  };

  return labelByType[definition.type];
}

export class PickupSystem {
  private readonly scene: Phaser.Scene;
  private readonly runtimes: PickupRuntime[];
  private ownsInteractionHint = false;

  constructor(scene: Phaser.Scene, config: PickupSystemConfig) {
    this.scene = scene;
    this.runtimes = config.pickups.map((pickup) => {
      const marker = this.scene.add.circle(
        pickup.x,
        pickup.y,
        10,
        this.getPickupColor(pickup.type),
        0.85
      ).setDepth(14);

      const label = this.scene.add.text(pickup.x, pickup.y - 18, getDisplayLabel(pickup), {
        fontSize: '10px',
        color: '#e2e8f0',
        stroke: '#0f172a',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(14).setAlpha(0.72);

      return {
        definition: pickup,
        consumed: false,
        marker,
        label
      };
    });
  }

  static fromJSON(scene: Phaser.Scene, input: string | PickupSystemConfig | PickupSystemConfigRaw): PickupSystem {
    const parsed = typeof input === 'string'
      ? (JSON.parse(input) as PickupSystemConfigRaw)
      : input;

    return new PickupSystem(scene, PickupSystem.normalizeConfig(parsed));
  }


  private static normalizeConfig(input: PickupSystemConfig | PickupSystemConfigRaw): PickupSystemConfig {
    const rawPickups = input.pickups ?? [];
    const pickups: PickupDefinition[] = rawPickups
      .filter((entry): entry is PickupDefinition => Boolean(
        entry.id
        && entry.type
        && PickupSystem.isValidPickupType(entry.type)
        && typeof entry.x === 'number'
        && typeof entry.y === 'number'
      ))
      .map((entry) => ({
        id: entry.id,
        type: entry.type as PickupType,
        x: entry.x,
        y: entry.y,
        label: entry.label,
        interactionRadius: entry.interactionRadius
      }));

    return { pickups };
  }

  private static isValidPickupType(type: string): type is PickupType {
    return [
      'food_small',
      'food_medium',
      'food_large',
      'medkit_small',
      'medkit_medium',
      'medkit_large',
      'ammo_pistol',
      'ammo_revolver',
      'ammo_smg',
      'ammo_shotgun',
      'ammo_carbine',
      'ammo_sniper_rifle',
      'ammo_light_machine_gun'
    ].includes(type);
  }

  update(players: Player[], consumers: PickupConsumer[]): void {
    const candidate = this.findNearestAvailablePickup(players);

    if (!candidate) {
      this.clearOwnedHint();
      return;
    }

    this.setInteractionHint(`E · RECOGER ${getDisplayLabel(candidate.runtime.definition)}`);

    const interactor = players.find((player) => (
      player.isInteractJustPressed() && this.isPlayerInPickupRange(player, candidate.runtime.definition)
    ));

    if (!interactor) {
      return;
    }

    const applied = this.applyPickup(candidate.runtime, consumers);
    if (!applied) {
      this.setInteractionHint('No hay receptor válido para este pickup.');
      return;
    }

    candidate.runtime.consumed = true;
    candidate.runtime.marker.destroy();
    candidate.runtime.label.destroy();
    this.setInteractionHint(`${getDisplayLabel(candidate.runtime.definition)} recogido.`);
  }

  destroy(): void {
    this.clearOwnedHint();

    this.runtimes.forEach((runtime) => {
      if (!runtime.consumed) {
        runtime.marker.destroy();
        runtime.label.destroy();
      }
    });
  }

  private applyPickup(runtime: PickupRuntime, consumers: PickupConsumer[]): boolean {
    return PickupSystem.applyReward(runtime.definition, consumers);
  }

  static applyReward(definition: PickupRewardDefinition, consumers: PickupConsumer[]): boolean {
    const { type, x, y } = definition;

    if (isHealthPickup(type)) {
      const target = consumers
        .filter((consumer) => consumer.getHealth() < consumer.getMaxHealth())
        .sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, x, y) - Phaser.Math.Distance.Between(b.x, b.y, x, y))[0];
      if (!target) {
        return false;
      }

      const restored = target.restoreHealth(HEALTH_RESTORE_BY_PICKUP[type]);
      return restored > 0;
    }

    if (isAmmoPickup(type)) {
      const reward = AMMO_REWARD_BY_PICKUP[type];
      const target = consumers
        .filter((consumer) => consumer.canReceiveAmmoType(reward.ammoType))
        .sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, x, y) - Phaser.Math.Distance.Between(b.x, b.y, x, y))[0];
      if (!target) {
        return false;
      }

      const added = target.addAmmoReserve(reward.ammoType, reward.amount);
      return added > 0;
    }

    return false;
  }

  static describeReward(definition: Pick<PickupRewardDefinition, 'type' | 'label'>): string {
    return getDisplayLabel(definition);
  }

  private findNearestHealthConsumer(consumers: PickupConsumer[], x: number, y: number): PickupConsumer | undefined {
    return consumers
      .filter((consumer) => consumer.getHealth() < consumer.getMaxHealth())
      .sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, x, y) - Phaser.Math.Distance.Between(b.x, b.y, x, y))[0];
  }

  private findNearestAmmoConsumer(consumers: PickupConsumer[], ammoType: string, x: number, y: number): PickupConsumer | undefined {
    return consumers
      .filter((consumer) => consumer.canReceiveAmmoType(ammoType))
      .sort((a, b) => Phaser.Math.Distance.Between(a.x, a.y, x, y) - Phaser.Math.Distance.Between(b.x, b.y, x, y))[0];
  }

  private findNearestAvailablePickup(players: Player[]): { runtime: PickupRuntime; distance: number } | undefined {
    let nearest: { runtime: PickupRuntime; distance: number } | undefined;

    this.runtimes.forEach((runtime) => {
      if (runtime.consumed) {
        return;
      }

      const radius = runtime.definition.interactionRadius ?? DEFAULT_INTERACTION_RADIUS;
      players.forEach((player) => {
        const distance = Phaser.Math.Distance.Between(player.x, player.y, runtime.definition.x, runtime.definition.y);
        if (distance > radius) {
          return;
        }

        if (!nearest || distance < nearest.distance) {
          nearest = { runtime, distance };
        }
      });
    });

    return nearest;
  }

  private isPlayerInPickupRange(player: Player, pickup: PickupDefinition): boolean {
    const radius = pickup.interactionRadius ?? DEFAULT_INTERACTION_RADIUS;
    return Phaser.Math.Distance.Between(player.x, player.y, pickup.x, pickup.y) <= radius;
  }


  private setInteractionHint(message: string): void {
    this.scene.registry.set('interactionHint', message);
    this.ownsInteractionHint = true;
  }

  private clearOwnedHint(): void {
    if (!this.ownsInteractionHint) {
      return;
    }

    this.scene.registry.set('interactionHint', '');
    this.ownsInteractionHint = false;
  }


  private getPickupColor(type: PickupType): number {
    if (type.startsWith('food_')) {
      return 0x4ade80;
    }

    if (type.startsWith('medkit_')) {
      return 0xf87171;
    }

    return Phaser.Display.Color.HexStringToColor(visualTheme.palette.uiAccent).color;
  }
}
