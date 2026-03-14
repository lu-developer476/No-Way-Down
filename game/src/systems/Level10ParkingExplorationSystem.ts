export type ParkingVehicleKind = 'interactive' | 'decorative';
export type ParkingVehicleState = 'pending' | 'inspected' | 'usable' | 'locked';

export interface ParkingVehicleConfig {
  id: string;
  label: string;
  kind: ParkingVehicleKind;
  visualPlaceholder: string;
  requiredKeyId?: string;
  grantsItemIds?: string[];
}

export interface ParkingResourceConfig {
  id: string;
  label: string;
  category: 'key' | 'vehicle-part' | 'medical' | 'ammo' | 'story-item';
  foundAtVehicleId?: string;
}

export interface Level10ParkingExplorationConfig {
  levelId: string;
  vehicles: ParkingVehicleConfig[];
  resources: ParkingResourceConfig[];
}

export interface ParkingExplorationSnapshot {
  levelId: string;
  interactiveVehiclesTotal: number;
  interactiveVehiclesInspected: number;
  decorativeVehiclesTotal: number;
  vehicles: Array<{
    id: string;
    state: ParkingVehicleState;
    foundItems: string[];
  }>;
  resourcesCollected: string[];
}

export interface Level10ParkingExplorationCallbacks {
  onVehicleInspected?: (vehicle: ParkingVehicleConfig, snapshot: ParkingExplorationSnapshot) => void;
  onDecorativeVehicleObserved?: (vehicle: ParkingVehicleConfig, snapshot: ParkingExplorationSnapshot) => void;
  onResourceCollected?: (resource: ParkingResourceConfig, snapshot: ParkingExplorationSnapshot) => void;
  onVehicleUnlocked?: (vehicle: ParkingVehicleConfig, keyId: string, snapshot: ParkingExplorationSnapshot) => void;
  onStateChanged?: (snapshot: ParkingExplorationSnapshot) => void;
}

interface RuntimeVehicle {
  config: ParkingVehicleConfig;
  state: ParkingVehicleState;
  foundItems: string[];
}

/**
 * Sistema de exploración del estacionamiento para Nivel 10.
 *
 * Mantiene el estado de vehículos decorativos/interactivos y recolección
 * de recursos, desacoplado de cualquier escena concreta.
 */
export class Level10ParkingExplorationSystem {
  private readonly config: Level10ParkingExplorationConfig;
  private readonly callbacks: Level10ParkingExplorationCallbacks;
  private readonly runtimeVehicles: RuntimeVehicle[];
  private readonly collectedResources = new Set<string>();

  static fromJson(
    config: Level10ParkingExplorationConfig,
    callbacks: Level10ParkingExplorationCallbacks = {}
  ): Level10ParkingExplorationSystem {
    return new Level10ParkingExplorationSystem(config, callbacks);
  }

  constructor(
    config: Level10ParkingExplorationConfig,
    callbacks: Level10ParkingExplorationCallbacks = {}
  ) {
    this.validateConfig(config);

    this.config = config;
    this.callbacks = callbacks;
    this.runtimeVehicles = config.vehicles.map((vehicle) => ({
      config: vehicle,
      state: vehicle.kind === 'decorative' ? 'pending' : vehicle.requiredKeyId ? 'locked' : 'pending',
      foundItems: []
    }));

    this.emitStateChanged();
  }

  inspectVehicle(vehicleId: string): ParkingResourceConfig[] {
    const runtimeVehicle = this.runtimeVehicles.find((vehicle) => vehicle.config.id === vehicleId);
    if (!runtimeVehicle) {
      return [];
    }

    if (runtimeVehicle.config.kind === 'decorative') {
      runtimeVehicle.state = 'inspected';
      const snapshot = this.getSnapshot();
      this.callbacks.onDecorativeVehicleObserved?.(runtimeVehicle.config, snapshot);
      this.emitStateChanged();
      return [];
    }

    if (runtimeVehicle.state === 'locked') {
      return [];
    }

    runtimeVehicle.state = 'inspected';
    const discovered = (runtimeVehicle.config.grantsItemIds ?? [])
      .map((resourceId) => this.config.resources.find((resource) => resource.id === resourceId))
      .filter((resource): resource is ParkingResourceConfig => Boolean(resource))
      .filter((resource) => !this.collectedResources.has(resource.id));

    discovered.forEach((resource) => {
      this.collectedResources.add(resource.id);
      runtimeVehicle.foundItems.push(resource.id);
      this.callbacks.onResourceCollected?.(resource, this.getSnapshot());
    });

    this.callbacks.onVehicleInspected?.(runtimeVehicle.config, this.getSnapshot());
    this.emitStateChanged();
    return discovered;
  }

  unlockVehicle(vehicleId: string, keyId: string): boolean {
    const runtimeVehicle = this.runtimeVehicles.find((vehicle) => vehicle.config.id === vehicleId);
    if (!runtimeVehicle || runtimeVehicle.state !== 'locked') {
      return false;
    }

    if (runtimeVehicle.config.requiredKeyId !== keyId || !this.collectedResources.has(keyId)) {
      return false;
    }

    runtimeVehicle.state = 'usable';
    this.callbacks.onVehicleUnlocked?.(runtimeVehicle.config, keyId, this.getSnapshot());
    this.emitStateChanged();
    return true;
  }

  isVehicleUsable(vehicleId: string): boolean {
    return this.runtimeVehicles.some((vehicle) => vehicle.config.id === vehicleId && vehicle.state === 'usable');
  }

  hasCollectedResource(resourceId: string): boolean {
    return this.collectedResources.has(resourceId);
  }

  getSnapshot(): ParkingExplorationSnapshot {
    const interactiveVehicles = this.runtimeVehicles.filter((vehicle) => vehicle.config.kind === 'interactive');

    return {
      levelId: this.config.levelId,
      interactiveVehiclesTotal: interactiveVehicles.length,
      interactiveVehiclesInspected: interactiveVehicles.filter((vehicle) => vehicle.state !== 'pending').length,
      decorativeVehiclesTotal: this.runtimeVehicles.filter((vehicle) => vehicle.config.kind === 'decorative').length,
      vehicles: this.runtimeVehicles.map((vehicle) => ({
        id: vehicle.config.id,
        state: vehicle.state,
        foundItems: [...vehicle.foundItems]
      })),
      resourcesCollected: [...this.collectedResources.values()]
    };
  }

  private emitStateChanged(): void {
    this.callbacks.onStateChanged?.(this.getSnapshot());
  }

  private validateConfig(config: Level10ParkingExplorationConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('Level10ParkingExplorationSystem: levelId es obligatorio.');
    }

    if (config.vehicles.length === 0) {
      throw new Error('Level10ParkingExplorationSystem: vehicles requiere al menos 1 vehículo.');
    }

    const vehicleIds = new Set<string>();
    config.vehicles.forEach((vehicle) => {
      if (vehicle.id.trim().length === 0) {
        throw new Error('Level10ParkingExplorationSystem: cada vehículo requiere id no vacío.');
      }

      if (vehicleIds.has(vehicle.id)) {
        throw new Error(`Level10ParkingExplorationSystem: id de vehículo duplicado "${vehicle.id}".`);
      }

      vehicleIds.add(vehicle.id);

      if (vehicle.kind === 'interactive' && (vehicle.visualPlaceholder?.trim().length ?? 0) === 0) {
        throw new Error(`Level10ParkingExplorationSystem: el vehículo "${vehicle.id}" requiere visualPlaceholder.`);
      }
    });

    const resourceIds = new Set<string>();
    config.resources.forEach((resource) => {
      if (resource.id.trim().length === 0) {
        throw new Error('Level10ParkingExplorationSystem: cada recurso requiere id no vacío.');
      }

      if (resourceIds.has(resource.id)) {
        throw new Error(`Level10ParkingExplorationSystem: id de recurso duplicado "${resource.id}".`);
      }

      resourceIds.add(resource.id);
    });
  }
}
