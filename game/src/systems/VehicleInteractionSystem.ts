export type VehicleType = 'decorative' | 'interactive-resource' | 'locked-breakable' | 'escape-usable';

export interface VehicleGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface VehicleDefinition {
  id: string;
  label: string;
  type: VehicleType;
  position: { x: number; y: number };
  size: { width: number; height: number };
  interactable: boolean;
  containsResources: boolean;
  containsWeapon: boolean;
  containsAmmo: boolean;
  containsUsefulVehicleItem: boolean;
  locked: boolean;
  breakable: boolean;
  usableForEscape: boolean;
}

export interface VehicleInteractionConfig {
  levelId: string;
  vehicles: VehicleDefinition[];
}

export type VehicleInteractionOutcome =
  | 'inspected'
  | 'opened'
  | 'blocked'
  | 'forced-open'
  | 'escape-ready';

export interface VehicleLootSnapshot {
  resources: boolean;
  weapon: boolean;
  ammo: boolean;
  usefulVehicleItem: boolean;
}

export interface VehicleRuntimeState {
  id: string;
  type: VehicleType;
  inspected: boolean;
  opened: boolean;
  forcedOpen: boolean;
  locked: boolean;
  usableForEscape: boolean;
  lootCollected: VehicleLootSnapshot;
}

export interface VehicleInteractionResult {
  vehicleId: string;
  outcome: VehicleInteractionOutcome;
  message: string;
  loot?: VehicleLootSnapshot;
  state: VehicleRuntimeState;
}

export interface VehicleInteractionSnapshot {
  levelId: string;
  totalVehicles: number;
  inspectedVehicles: number;
  openedVehicles: number;
  forcedOpenVehicles: number;
  escapeVehicleId?: string;
  escapeVehicleReady: boolean;
  vehicles: VehicleRuntimeState[];
}

export interface VehicleInteractionCallbacks {
  onVehicleInteracted?: (result: VehicleInteractionResult, snapshot: VehicleInteractionSnapshot) => void;
  onVehicleForcedOpen?: (result: VehicleInteractionResult, snapshot: VehicleInteractionSnapshot) => void;
  onEscapeVehicleReady?: (result: VehicleInteractionResult, snapshot: VehicleInteractionSnapshot) => void;
  onStateChanged?: (snapshot: VehicleInteractionSnapshot) => void;
}

interface RuntimeVehicle {
  definition: VehicleDefinition;
  state: VehicleRuntimeState;
}

/**
 * Sistema reutilizable para modelar vehículos interactivos de cualquier nivel.
 *
 * La escena sólo necesita enviar IDs de vehículo al interactuar; todo el estado
 * (bloqueado, abierto por fuerza, botín y disponibilidad de escape) vive acá.
 */
export class VehicleInteractionSystem {
  private readonly config: VehicleInteractionConfig;
  private readonly callbacks: VehicleInteractionCallbacks;
  private readonly runtimeVehicles: RuntimeVehicle[];

  static fromJson(
    config: VehicleInteractionConfig,
    callbacks: VehicleInteractionCallbacks = {}
  ): VehicleInteractionSystem {
    return new VehicleInteractionSystem(config, callbacks);
  }

  constructor(config: VehicleInteractionConfig, callbacks: VehicleInteractionCallbacks = {}) {
    this.validateConfig(config);

    this.config = config;
    this.callbacks = callbacks;
    this.runtimeVehicles = config.vehicles.map((vehicle) => ({
      definition: vehicle,
      state: {
        id: vehicle.id,
        type: vehicle.type,
        inspected: false,
        opened: !vehicle.interactable,
        forcedOpen: false,
        locked: vehicle.locked,
        usableForEscape: vehicle.usableForEscape,
        lootCollected: {
          resources: false,
          weapon: false,
          ammo: false,
          usefulVehicleItem: false
        }
      }
    }));

    this.emitStateChanged();
  }

  interact(vehicleId: string): VehicleInteractionResult {
    const runtimeVehicle = this.findVehicle(vehicleId);
    if (!runtimeVehicle) {
      throw new Error(`VehicleInteractionSystem: vehículo "${vehicleId}" no existe.`);
    }

    runtimeVehicle.state.inspected = true;

    if (!runtimeVehicle.definition.interactable) {
      return this.emitInteractionResult(runtimeVehicle, {
        outcome: 'inspected',
        message: `${runtimeVehicle.definition.label} es decorativo, no hay interacción.`
      });
    }

    if (runtimeVehicle.state.locked) {
      return this.emitInteractionResult(runtimeVehicle, {
        outcome: 'blocked',
        message: `${runtimeVehicle.definition.label} está cerrado.`
      });
    }

    runtimeVehicle.state.opened = true;
    runtimeVehicle.state.lootCollected = this.collectLoot(runtimeVehicle.definition);

    const outcome: VehicleInteractionOutcome = runtimeVehicle.definition.usableForEscape ? 'escape-ready' : 'opened';
    const message = runtimeVehicle.definition.usableForEscape
      ? `${runtimeVehicle.definition.label} quedó listo para escape.`
      : `${runtimeVehicle.definition.label} fue abierto e inspeccionado.`;

    return this.emitInteractionResult(runtimeVehicle, {
      outcome,
      message,
      loot: { ...runtimeVehicle.state.lootCollected }
    });
  }

  forceOpen(vehicleId: string): VehicleInteractionResult {
    const runtimeVehicle = this.findVehicle(vehicleId);
    if (!runtimeVehicle) {
      throw new Error(`VehicleInteractionSystem: vehículo "${vehicleId}" no existe.`);
    }

    runtimeVehicle.state.inspected = true;

    if (!runtimeVehicle.definition.interactable) {
      return this.emitInteractionResult(runtimeVehicle, {
        outcome: 'blocked',
        message: `${runtimeVehicle.definition.label} no es interactuable.`
      });
    }

    if (!runtimeVehicle.state.locked) {
      return this.interact(vehicleId);
    }

    if (!runtimeVehicle.definition.breakable) {
      return this.emitInteractionResult(runtimeVehicle, {
        outcome: 'blocked',
        message: `${runtimeVehicle.definition.label} está cerrado y no se puede romper.`
      });
    }

    runtimeVehicle.state.locked = false;
    runtimeVehicle.state.forcedOpen = true;
    runtimeVehicle.state.opened = true;
    runtimeVehicle.state.lootCollected = this.collectLoot(runtimeVehicle.definition);

    const outcome: VehicleInteractionOutcome = runtimeVehicle.definition.usableForEscape ? 'escape-ready' : 'forced-open';
    const message = runtimeVehicle.definition.usableForEscape
      ? `${runtimeVehicle.definition.label} se abrió por fuerza y quedó listo para escape.`
      : `${runtimeVehicle.definition.label} se abrió por fuerza.`;

    return this.emitInteractionResult(runtimeVehicle, {
      outcome,
      message,
      loot: { ...runtimeVehicle.state.lootCollected }
    });
  }

  getVehicleBounds(vehicleId: string): VehicleGeometry | undefined {
    const runtimeVehicle = this.findVehicle(vehicleId);
    if (!runtimeVehicle) {
      return undefined;
    }

    return {
      x: runtimeVehicle.definition.position.x,
      y: runtimeVehicle.definition.position.y,
      width: runtimeVehicle.definition.size.width,
      height: runtimeVehicle.definition.size.height
    };
  }

  getSnapshot(): VehicleInteractionSnapshot {
    const vehicles = this.runtimeVehicles.map((vehicle) => ({
      ...vehicle.state,
      lootCollected: { ...vehicle.state.lootCollected }
    }));

    const escapeVehicle = this.runtimeVehicles.find((vehicle) => vehicle.definition.usableForEscape);

    return {
      levelId: this.config.levelId,
      totalVehicles: vehicles.length,
      inspectedVehicles: vehicles.filter((vehicle) => vehicle.inspected).length,
      openedVehicles: vehicles.filter((vehicle) => vehicle.opened).length,
      forcedOpenVehicles: vehicles.filter((vehicle) => vehicle.forcedOpen).length,
      escapeVehicleId: escapeVehicle?.definition.id,
      escapeVehicleReady: escapeVehicle ? escapeVehicle.state.opened : false,
      vehicles
    };
  }

  private collectLoot(definition: VehicleDefinition): VehicleLootSnapshot {
    return {
      resources: definition.containsResources,
      weapon: definition.containsWeapon,
      ammo: definition.containsAmmo,
      usefulVehicleItem: definition.containsUsefulVehicleItem
    };
  }

  private emitInteractionResult(
    runtimeVehicle: RuntimeVehicle,
    partial: Pick<VehicleInteractionResult, 'outcome' | 'message' | 'loot'>
  ): VehicleInteractionResult {
    const result: VehicleInteractionResult = {
      vehicleId: runtimeVehicle.definition.id,
      outcome: partial.outcome,
      message: partial.message,
      loot: partial.loot,
      state: {
        ...runtimeVehicle.state,
        lootCollected: { ...runtimeVehicle.state.lootCollected }
      }
    };

    const snapshot = this.getSnapshot();

    this.callbacks.onVehicleInteracted?.(result, snapshot);
    if (result.outcome === 'forced-open') {
      this.callbacks.onVehicleForcedOpen?.(result, snapshot);
    }

    if (result.outcome === 'escape-ready') {
      this.callbacks.onEscapeVehicleReady?.(result, snapshot);
    }

    this.emitStateChanged(snapshot);
    return result;
  }

  private emitStateChanged(snapshot = this.getSnapshot()): void {
    this.callbacks.onStateChanged?.(snapshot);
  }

  private findVehicle(vehicleId: string): RuntimeVehicle | undefined {
    return this.runtimeVehicles.find((vehicle) => vehicle.definition.id === vehicleId);
  }

  private validateConfig(config: VehicleInteractionConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('VehicleInteractionSystem: levelId es obligatorio.');
    }

    if (config.vehicles.length === 0) {
      throw new Error('VehicleInteractionSystem: se requiere al menos 1 vehículo.');
    }

    const ids = new Set<string>();
    let escapeVehicles = 0;

    config.vehicles.forEach((vehicle) => {
      if (vehicle.id.trim().length === 0) {
        throw new Error('VehicleInteractionSystem: cada vehículo requiere id no vacío.');
      }

      if (ids.has(vehicle.id)) {
        throw new Error(`VehicleInteractionSystem: id de vehículo duplicado "${vehicle.id}".`);
      }

      ids.add(vehicle.id);

      if (vehicle.size.width <= 0 || vehicle.size.height <= 0) {
        throw new Error(`VehicleInteractionSystem: tamaño inválido en "${vehicle.id}".`);
      }

      if (!vehicle.interactable && vehicle.type !== 'decorative') {
        throw new Error(`VehicleInteractionSystem: "${vehicle.id}" no interactuable debe ser tipo decorative.`);
      }

      if (vehicle.locked && !vehicle.interactable) {
        throw new Error(`VehicleInteractionSystem: "${vehicle.id}" no puede estar cerrado si no es interactuable.`);
      }

      if (vehicle.usableForEscape) {
        escapeVehicles += 1;
      }
    });

    if (escapeVehicles > 1) {
      throw new Error('VehicleInteractionSystem: sólo se permite 1 vehículo de escape por configuración.');
    }
  }
}
