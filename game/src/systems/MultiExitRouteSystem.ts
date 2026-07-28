export type MultiExitRouteState =
  | 'falsa_salida'
  | 'obstruida'
  | 'caotica'
  | 'infectada'
  | 'operativa_persianas_bajas'
  | 'desconocida'
  | 'bloqueada';

export type MultiExitTriggerType = 'inspection' | 'activation' | 'zone_enter' | 'interaction' | 'scripted';

export type MultiExitOutcomeType =
  | 'narrative'
  | 'combat'
  | 'progress'
  | 'retreat'
  | 'ally_loss'
  | 'state_change'
  | 'custom';

export interface MultiExitOutcome {
  type: MultiExitOutcomeType;
  eventId: string;
  description?: string;
  payload?: Record<string, unknown>;
}

export interface MultiExitTrigger {
  type: MultiExitTriggerType;
  id?: string;
  label?: string;
  availableByDefault?: boolean;
  consumesAfterUse?: boolean;
}

export interface MultiExitRouteDefinition {
  id: string;
  label: string;
  description?: string;
  initialState: MultiExitRouteState;
  inspectionOutcomes?: MultiExitOutcome[];
  activationOutcomes?: MultiExitOutcome[];
  triggerOutcomes?: Partial<Record<MultiExitTriggerType, MultiExitOutcome[]>>;
  triggers?: MultiExitTrigger[];
  metadata?: Record<string, unknown>;
}

export interface MultiExitRouteSystemConfig {
  levelId: string;
  routes: MultiExitRouteDefinition[];
  registryKey?: string;
}

export interface MultiExitRouteSnapshot {
  id: string;
  label: string;
  state: MultiExitRouteState;
  inspectionCount: number;
  activationCount: number;
  triggerUsageCount: number;
  consumedTriggers: string[];
  metadata?: Record<string, unknown>;
}

export interface MultiExitSystemSnapshot {
  levelId: string;
  routes: MultiExitRouteSnapshot[];
}

export interface MultiExitEvent {
  routeId: string;
  state: MultiExitRouteState;
  action: 'inspect' | 'activate' | 'trigger';
  triggerType?: MultiExitTriggerType;
  triggerId?: string;
  outcomes: MultiExitOutcome[];
  snapshot: MultiExitRouteSnapshot;
}

export interface MultiExitRouteCallbacks {
  onRouteInspected?: (event: MultiExitEvent) => void;
  onRouteActivated?: (event: MultiExitEvent) => void;
  onTriggerFired?: (event: MultiExitEvent) => void;
  onRouteStateChanged?: (route: MultiExitRouteSnapshot) => void;
}

interface RuntimeRoute {
  definition: MultiExitRouteDefinition;
  currentState: MultiExitRouteState;
  inspectionCount: number;
  activationCount: number;
  triggerUsageCount: number;
  consumedTriggers: Set<string>;
}

/**
 * Sistema reutilizable para modelar múltiples salidas en cualquier nivel.
 *
 * Diseñado para mantener la lógica de evaluación de rutas fuera de GameScene
 * y reaccionar a inspecciones/activaciones mediante eventos de salida.
 */
export class MultiExitRouteSystem {
  private readonly config: MultiExitRouteSystemConfig;
  private readonly callbacks: MultiExitRouteCallbacks;
  private readonly routes: Map<string, RuntimeRoute>;

  static fromJSON(
    input: string | MultiExitRouteSystemConfig,
    callbacks: MultiExitRouteCallbacks = {}
  ): MultiExitRouteSystem {
    const config = typeof input === 'string' ? (JSON.parse(input) as MultiExitRouteSystemConfig) : input;
    return new MultiExitRouteSystem(config, callbacks);
  }

  constructor(config: MultiExitRouteSystemConfig, callbacks: MultiExitRouteCallbacks = {}) {
    this.validateConfig(config);
    this.config = config;
    this.callbacks = callbacks;
    this.routes = new Map(
      config.routes.map((route) => [
        route.id,
        {
          definition: {
            ...route,
            inspectionOutcomes: route.inspectionOutcomes ?? [],
            activationOutcomes: route.activationOutcomes ?? [],
            triggerOutcomes: route.triggerOutcomes ?? {},
            triggers: (route.triggers ?? []).map((trigger) => ({
              ...trigger,
              availableByDefault: trigger.availableByDefault ?? true,
              consumesAfterUse: trigger.consumesAfterUse ?? false
            }))
          },
          currentState: route.initialState,
          inspectionCount: 0,
          activationCount: 0,
          triggerUsageCount: 0,
          consumedTriggers: new Set<string>()
        }
      ])
    );
  }

  getLevelId(): string {
    return this.config.levelId;
  }

  getRoute(routeId: string): MultiExitRouteSnapshot {
    const route = this.getRuntimeRoute(routeId);
    return this.toSnapshot(route);
  }

  getRoutes(): MultiExitRouteSnapshot[] {
    return this.getSnapshot().routes;
  }

  getSnapshot(): MultiExitSystemSnapshot {
    return {
      levelId: this.config.levelId,
      routes: [...this.routes.values()].map((route) => this.toSnapshot(route))
    };
  }

  inspectRoute(routeId: string): MultiExitOutcome[] {
    const route = this.getRuntimeRoute(routeId);
    route.inspectionCount += 1;
    const outcomes = [...(route.definition.inspectionOutcomes ?? [])];
    const snapshot = this.toSnapshot(route);

    this.callbacks.onRouteInspected?.({
      routeId,
      state: route.currentState,
      action: 'inspect',
      outcomes,
      snapshot
    });

    return outcomes;
  }

  activateRoute(routeId: string): MultiExitOutcome[] {
    const route = this.getRuntimeRoute(routeId);
    route.activationCount += 1;
    const outcomes = [...(route.definition.activationOutcomes ?? [])];
    const snapshot = this.toSnapshot(route);

    this.callbacks.onRouteActivated?.({
      routeId,
      state: route.currentState,
      action: 'activate',
      outcomes,
      snapshot
    });

    return outcomes;
  }

  fireRouteTrigger(routeId: string, triggerType: MultiExitTriggerType, triggerId?: string): MultiExitOutcome[] {
    const route = this.getRuntimeRoute(routeId);
    const trigger = route.definition.triggers?.find(
      (candidate) => candidate.type === triggerType && (!triggerId || candidate.id === triggerId)
    );

    if (trigger) {
      const isConsumed = trigger.id ? route.consumedTriggers.has(trigger.id) : false;
      const isAvailable = trigger.availableByDefault ?? true;
      if (!isAvailable || isConsumed) {
        return [];
      }
    }

    route.triggerUsageCount += 1;
    if (trigger?.id && trigger.consumesAfterUse) {
      route.consumedTriggers.add(trigger.id);
    }

    const configuredOutcomes = route.definition.triggerOutcomes?.[triggerType] ?? [];
    const outcomes = [...configuredOutcomes];
    const snapshot = this.toSnapshot(route);

    this.callbacks.onTriggerFired?.({
      routeId,
      state: route.currentState,
      action: 'trigger',
      triggerType,
      triggerId,
      outcomes,
      snapshot
    });

    return outcomes;
  }

  setRouteState(routeId: string, nextState: MultiExitRouteState): MultiExitRouteSnapshot {
    const route = this.getRuntimeRoute(routeId);
    route.currentState = nextState;

    const snapshot = this.toSnapshot(route);
    this.callbacks.onRouteStateChanged?.(snapshot);
    return snapshot;
  }

  private toSnapshot(route: RuntimeRoute): MultiExitRouteSnapshot {
    return {
      id: route.definition.id,
      label: route.definition.label,
      state: route.currentState,
      inspectionCount: route.inspectionCount,
      activationCount: route.activationCount,
      triggerUsageCount: route.triggerUsageCount,
      consumedTriggers: [...route.consumedTriggers.values()],
      metadata: route.definition.metadata
    };
  }

  private getRuntimeRoute(routeId: string): RuntimeRoute {
    const route = this.routes.get(routeId);
    if (!route) {
      throw new Error(`MultiExitRouteSystem: no existe la ruta "${routeId}".`);
    }

    return route;
  }

  private validateConfig(config: MultiExitRouteSystemConfig): void {
    if (!config.levelId.trim()) {
      throw new Error('MultiExitRouteSystem: levelId es obligatorio.');
    }

    if (!Array.isArray(config.routes) || config.routes.length === 0) {
      throw new Error('MultiExitRouteSystem: routes debe contener al menos una salida.');
    }

    const seenIds = new Set<string>();
    config.routes.forEach((route) => {
      if (!route.id.trim()) {
        throw new Error('MultiExitRouteSystem: cada salida requiere id no vacío.');
      }

      if (seenIds.has(route.id)) {
        throw new Error(`MultiExitRouteSystem: id de salida duplicado "${route.id}".`);
      }

      seenIds.add(route.id);

      if (!route.label.trim()) {
        throw new Error(`MultiExitRouteSystem: la salida "${route.id}" requiere label.`);
      }
    });
  }
}
