export type InteractableType = 'door' | 'stairs' | 'vehicle' | 'loot_container' | 'switch' | 'ally_rescue';

export type InteractableEffectType =
  | 'door'
  | 'stairs'
  | 'vehicle'
  | 'loot'
  | 'switch'
  | 'ally_rescue'
  | 'custom';

export type InteractablePickupType =
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

export interface InteractableEffect {
  type: InteractableEffectType;
  targetId?: string;
  message?: string;
  rewardId?: string;
  rewardPickupType?: InteractablePickupType;
  rewardPickupLabel?: string;
  consumesOnUse?: boolean;
  objectiveEventType?: string;
  checkpoint?: {
    x: number;
    y: number;
    label?: string;
  };
}

export interface InteractableDefinition {
  id: string;
  type: InteractableType;
  x: number;
  y: number;
  interactionKey: string;
  interactionRadius: number;
  interactionEffect: InteractableEffect;
  cinematicTrigger?: string;
  prompt?: string;
  enabled?: boolean;
}

export interface InteractableRuntime {
  id: string;
  enabled: boolean;
  interactions: number;
  lastInteractedAt?: number;
}

export interface InteractableMatch {
  definition: InteractableDefinition;
  runtime: InteractableRuntime;
  distance: number;
}

export interface InteractableInteractionResult {
  success: boolean;
  definition?: InteractableDefinition;
  runtime?: InteractableRuntime;
  effect?: InteractableEffect;
  cinematicTrigger?: string;
  reason?: 'missing' | 'disabled' | 'wrong-key' | 'out-of-range';
}

interface InteractableEntry {
  definition: InteractableDefinition;
  runtime: InteractableRuntime;
}

const DEFAULT_INTERACTION_KEY = 'E';

export class InteractableSystem {
  private readonly entries = new Map<string, InteractableEntry>();

  constructor(definitions: InteractableDefinition[]) {
    definitions.forEach((definition) => {
      this.register(definition);
    });
  }

  register(definition: InteractableDefinition): void {
    const normalized: InteractableDefinition = {
      ...definition,
      interactionKey: (definition.interactionKey ?? DEFAULT_INTERACTION_KEY).toUpperCase(),
      interactionRadius: Math.max(20, definition.interactionRadius ?? 100),
      enabled: definition.enabled ?? true
    };

    this.entries.set(normalized.id, {
      definition: normalized,
      runtime: {
        id: normalized.id,
        enabled: normalized.enabled ?? true,
        interactions: 0
      }
    });
  }

  findNearby(x: number, y: number): InteractableMatch | undefined {
    let nearest: InteractableMatch | undefined;

    this.entries.forEach((entry) => {
      if (!entry.runtime.enabled) {
        return;
      }

      const distance = Math.hypot(x - entry.definition.x, y - entry.definition.y);
      if (distance > entry.definition.interactionRadius) {
        return;
      }

      if (!nearest || distance < nearest.distance) {
        nearest = {
          definition: entry.definition,
          runtime: { ...entry.runtime },
          distance
        };
      }
    });

    return nearest;
  }

  getPromptFor(x: number, y: number): string {
    const nearest = this.findNearby(x, y);
    if (!nearest) {
      return '';
    }

    return nearest.definition.prompt ?? `${nearest.definition.interactionKey} · ${this.describeType(nearest.definition.type)}`;
  }

  tryInteract(x: number, y: number, pressedKey: string): InteractableInteractionResult {
    const nearest = this.findNearby(x, y);
    if (!nearest) {
      return { success: false, reason: 'missing' };
    }

    const entry = this.entries.get(nearest.definition.id);
    if (!entry) {
      return { success: false, reason: 'missing' };
    }

    if (!entry.runtime.enabled) {
      return { success: false, reason: 'disabled' };
    }

    if (nearest.distance > nearest.definition.interactionRadius) {
      return { success: false, reason: 'out-of-range' };
    }

    if (nearest.definition.interactionKey !== pressedKey.toUpperCase()) {
      return { success: false, reason: 'wrong-key' };
    }

    entry.runtime.interactions += 1;
    entry.runtime.lastInteractedAt = Date.now();

    return {
      success: true,
      definition: entry.definition,
      runtime: { ...entry.runtime },
      effect: { ...entry.definition.interactionEffect },
      cinematicTrigger: entry.definition.cinematicTrigger
    };
  }

  setEnabled(id: string, enabled: boolean): void {
    const entry = this.entries.get(id);
    if (!entry) {
      return;
    }

    entry.runtime.enabled = enabled;
  }

  consume(id: string): void {
    this.setEnabled(id, false);
  }

  getSnapshot(): InteractableRuntime[] {
    return [...this.entries.values()].map((entry) => ({ ...entry.runtime }));
  }

  reset(): void {
    this.entries.forEach((entry) => {
      entry.runtime.enabled = entry.definition.enabled ?? true;
      entry.runtime.interactions = 0;
      entry.runtime.lastInteractedAt = undefined;
    });
  }

  private describeType(type: InteractableType): string {
    switch (type) {
      case 'door':
        return 'Abrir puerta';
      case 'stairs':
        return 'Usar escaleras';
      case 'vehicle':
        return 'Usar vehículo';
      case 'loot_container':
        return 'Revisar contenedor';
      case 'switch':
        return 'Activar switch';
      case 'ally_rescue':
        return 'Rescatar aliado';
      default:
        return 'Interactuar';
    }
  }
}
