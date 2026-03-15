export type VehicleLootInteractionType = 'open' | 'break';

export type VehicleLootItemCategory = 'resource' | 'weapon' | 'ammo' | 'vehicle-part' | 'quest';

export interface VehicleLootQuantityRange {
  min: number;
  max: number;
}

export interface VehicleLootDropDefinition {
  itemId: string;
  label: string;
  category: VehicleLootItemCategory;
  chance: number;
  quantity: number | VehicleLootQuantityRange;
  keyForEscape?: boolean;
}

export interface VehicleLootVehicleDefinition {
  id: string;
  label: string;
  locked: boolean;
  breakable: boolean;
  allowOpen: boolean;
  allowBreak: boolean;
  lootTable: VehicleLootDropDefinition[];
}

export interface VehicleLootConfig {
  levelId: string;
  vehicles: VehicleLootVehicleDefinition[];
}

export interface LootedItemResult {
  itemId: string;
  label: string;
  category: VehicleLootItemCategory;
  quantity: number;
  keyForEscape: boolean;
}

export interface VehicleLootRuntimeVehicleState {
  id: string;
  opened: boolean;
  broken: boolean;
  looted: boolean;
  locked: boolean;
  lastInteraction?: VehicleLootInteractionType;
}

export interface VehicleLootGroupState {
  resources: number;
  ammo: number;
  weapons: string[];
  vehicleParts: string[];
  questItems: string[];
  escapeKeyItems: string[];
}

export interface VehicleLootSnapshot {
  levelId: string;
  totalVehicles: number;
  lootedVehicles: number;
  vehicles: VehicleLootRuntimeVehicleState[];
  groupState: VehicleLootGroupState;
}

export type VehicleLootInteractionOutcome =
  | 'opened'
  | 'forced-open'
  | 'blocked'
  | 'already-looted';

export interface VehicleLootInteractionResult {
  vehicleId: string;
  interaction: VehicleLootInteractionType;
  outcome: VehicleLootInteractionOutcome;
  message: string;
  items: LootedItemResult[];
  state: VehicleLootRuntimeVehicleState;
}

export interface VehicleLootCallbacks {
  onVehicleLooted?: (result: VehicleLootInteractionResult, snapshot: VehicleLootSnapshot) => void;
  onStateChanged?: (snapshot: VehicleLootSnapshot) => void;
}

interface RuntimeVehicle {
  definition: VehicleLootVehicleDefinition;
  state: VehicleLootRuntimeVehicleState;
}

export class VehicleLootSystem {
  private readonly config: VehicleLootConfig;
  private readonly callbacks: VehicleLootCallbacks;
  private readonly randomFn: () => number;
  private readonly runtimeVehicles: RuntimeVehicle[];
  private readonly groupState: VehicleLootGroupState;

  static fromJson(
    config: VehicleLootConfig,
    callbacks: VehicleLootCallbacks = {},
    randomFn: () => number = Math.random
  ): VehicleLootSystem {
    return new VehicleLootSystem(config, callbacks, randomFn);
  }

  constructor(
    config: VehicleLootConfig,
    callbacks: VehicleLootCallbacks = {},
    randomFn: () => number = Math.random
  ) {
    this.validateConfig(config);

    this.config = config;
    this.callbacks = callbacks;
    this.randomFn = randomFn;
    this.groupState = {
      resources: 0,
      ammo: 0,
      weapons: [],
      vehicleParts: [],
      questItems: [],
      escapeKeyItems: []
    };

    this.runtimeVehicles = config.vehicles.map((vehicle) => ({
      definition: vehicle,
      state: {
        id: vehicle.id,
        opened: false,
        broken: false,
        looted: false,
        locked: vehicle.locked
      }
    }));

    this.emitStateChanged();
  }

  interact(vehicleId: string, interaction: VehicleLootInteractionType): VehicleLootInteractionResult {
    const runtimeVehicle = this.findVehicle(vehicleId);
    if (!runtimeVehicle) {
      throw new Error(`VehicleLootSystem: vehículo "${vehicleId}" no existe.`);
    }

    const { definition, state } = runtimeVehicle;

    if (state.looted) {
      return this.emitResult(runtimeVehicle, interaction, 'already-looted', `${definition.label} ya fue saqueado.`, []);
    }

    if (interaction === 'open') {
      if (!definition.allowOpen) {
        return this.emitResult(runtimeVehicle, interaction, 'blocked', `${definition.label} no permite abrir manualmente.`, []);
      }

      if (state.locked) {
        return this.emitResult(runtimeVehicle, interaction, 'blocked', `${definition.label} está bloqueado.`, []);
      }

      state.opened = true;
      state.lastInteraction = 'open';
      const items = this.rollLoot(definition.lootTable);
      state.looted = true;
      this.applyLootToGroup(items);
      return this.emitResult(runtimeVehicle, interaction, 'opened', `${definition.label} abierto y saqueado.`, items);
    }

    if (!definition.allowBreak) {
      return this.emitResult(runtimeVehicle, interaction, 'blocked', `${definition.label} no se puede romper.`, []);
    }

    if (!definition.breakable) {
      return this.emitResult(runtimeVehicle, interaction, 'blocked', `${definition.label} resiste el intento de ruptura.`, []);
    }

    state.locked = false;
    state.broken = true;
    state.opened = true;
    state.lastInteraction = 'break';
    const items = this.rollLoot(definition.lootTable);
    state.looted = true;
    this.applyLootToGroup(items);
    return this.emitResult(runtimeVehicle, interaction, 'forced-open', `${definition.label} fue roto y saqueado.`, items);
  }

  getGroupState(): VehicleLootGroupState {
    return {
      resources: this.groupState.resources,
      ammo: this.groupState.ammo,
      weapons: [...this.groupState.weapons],
      vehicleParts: [...this.groupState.vehicleParts],
      questItems: [...this.groupState.questItems],
      escapeKeyItems: [...this.groupState.escapeKeyItems]
    };
  }

  getSnapshot(): VehicleLootSnapshot {
    return {
      levelId: this.config.levelId,
      totalVehicles: this.runtimeVehicles.length,
      lootedVehicles: this.runtimeVehicles.filter((vehicle) => vehicle.state.looted).length,
      vehicles: this.runtimeVehicles.map((vehicle) => ({ ...vehicle.state })),
      groupState: this.getGroupState()
    };
  }

  private rollLoot(table: VehicleLootDropDefinition[]): LootedItemResult[] {
    const items: LootedItemResult[] = [];

    table.forEach((entry) => {
      const roll = this.randomFn();
      if (roll > entry.chance) {
        return;
      }

      const quantity = this.resolveQuantity(entry.quantity);
      if (quantity <= 0) {
        return;
      }

      items.push({
        itemId: entry.itemId,
        label: entry.label,
        category: entry.category,
        quantity,
        keyForEscape: entry.keyForEscape ?? false
      });
    });

    return items;
  }

  private resolveQuantity(quantity: number | VehicleLootQuantityRange): number {
    if (typeof quantity === 'number') {
      return quantity;
    }

    const span = quantity.max - quantity.min + 1;
    return quantity.min + Math.floor(this.randomFn() * span);
  }

  private applyLootToGroup(items: LootedItemResult[]): void {
    items.forEach((item) => {
      switch (item.category) {
        case 'resource':
          this.groupState.resources += item.quantity;
          break;
        case 'ammo':
          this.groupState.ammo += item.quantity;
          break;
        case 'weapon':
          this.groupState.weapons.push(item.itemId);
          break;
        case 'vehicle-part':
          this.groupState.vehicleParts.push(item.itemId);
          break;
        case 'quest':
          this.groupState.questItems.push(item.itemId);
          break;
      }

      if (item.keyForEscape && !this.groupState.escapeKeyItems.includes(item.itemId)) {
        this.groupState.escapeKeyItems.push(item.itemId);
      }
    });
  }

  private emitResult(
    runtimeVehicle: RuntimeVehicle,
    interaction: VehicleLootInteractionType,
    outcome: VehicleLootInteractionOutcome,
    message: string,
    items: LootedItemResult[]
  ): VehicleLootInteractionResult {
    const result: VehicleLootInteractionResult = {
      vehicleId: runtimeVehicle.definition.id,
      interaction,
      outcome,
      message,
      items,
      state: { ...runtimeVehicle.state }
    };

    const snapshot = this.getSnapshot();
    this.callbacks.onVehicleLooted?.(result, snapshot);
    this.emitStateChanged(snapshot);

    return result;
  }

  private emitStateChanged(snapshot = this.getSnapshot()): void {
    this.callbacks.onStateChanged?.(snapshot);
  }

  private findVehicle(vehicleId: string): RuntimeVehicle | undefined {
    return this.runtimeVehicles.find((vehicle) => vehicle.definition.id === vehicleId);
  }

  private validateConfig(config: VehicleLootConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('VehicleLootSystem: levelId es obligatorio.');
    }

    if (config.vehicles.length === 0) {
      throw new Error('VehicleLootSystem: se requiere al menos un vehículo.');
    }

    const ids = new Set<string>();

    config.vehicles.forEach((vehicle) => {
      if (vehicle.id.trim().length === 0) {
        throw new Error('VehicleLootSystem: cada vehículo requiere id no vacío.');
      }

      if (ids.has(vehicle.id)) {
        throw new Error(`VehicleLootSystem: id duplicado "${vehicle.id}".`);
      }

      ids.add(vehicle.id);

      if (!vehicle.allowOpen && !vehicle.allowBreak) {
        throw new Error(`VehicleLootSystem: "${vehicle.id}" debe soportar abrir o romper.`);
      }

      if (vehicle.lootTable.length === 0) {
        throw new Error(`VehicleLootSystem: "${vehicle.id}" debe tener lootTable.`);
      }

      vehicle.lootTable.forEach((entry) => {
        if (entry.chance < 0 || entry.chance > 1) {
          throw new Error(`VehicleLootSystem: chance inválida en "${vehicle.id}:${entry.itemId}".`);
        }

        if (typeof entry.quantity === 'number') {
          if (entry.quantity < 0) {
            throw new Error(`VehicleLootSystem: quantity inválida en "${vehicle.id}:${entry.itemId}".`);
          }
        } else if (entry.quantity.min > entry.quantity.max || entry.quantity.min < 0) {
          throw new Error(`VehicleLootSystem: rango quantity inválido en "${vehicle.id}:${entry.itemId}".`);
        }
      });
    });
  }
}
