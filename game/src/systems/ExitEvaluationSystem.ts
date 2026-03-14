export type ExitEvaluationMode = 'sequential' | 'semi_free';

export type ExitEvaluationOutcomeType = 'combat' | 'narrative' | 'route_state';

export interface ExitEvaluationOutcome {
  type: ExitEvaluationOutcomeType;
  eventId: string;
  description: string;
  payload?: Record<string, unknown>;
}

export interface ExitEvaluationRouteState {
  stateId: string;
  isFinal?: boolean;
  tags?: string[];
}

export interface ExitEvaluationConfigEntry {
  id: string;
  label: string;
  description?: string;
  requiresEvaluated?: string[];
  outcomes: ExitEvaluationOutcome[];
  routeState: ExitEvaluationRouteState;
}

export interface ExitEvaluationConfig {
  levelId: string;
  mode: ExitEvaluationMode;
  openAfterBacktrackFromExitId?: string;
  orderedExitIds?: string[];
  exits: ExitEvaluationConfigEntry[];
}

export interface ExitEvaluationSnapshot {
  levelId: string;
  mode: ExitEvaluationMode;
  backtrackSatisfied: boolean;
  evaluatedExitIds: string[];
  pendingExitIds: string[];
  currentRouteState?: ExitEvaluationRouteState;
}

export interface ExitEvaluationResult {
  exitId: string;
  exitLabel: string;
  outcomes: ExitEvaluationOutcome[];
  routeState: ExitEvaluationRouteState;
  casualties: {
    irreversibleLoss: number;
  };
  snapshot: ExitEvaluationSnapshot;
}

export interface ExitEvaluationCallbacks {
  onExitEvaluated?: (result: ExitEvaluationResult) => void;
}

interface RuntimeExitEvaluation {
  config: ExitEvaluationConfigEntry;
  evaluated: boolean;
}

/**
 * Sistema de evaluación de salidas (Nivel 9) desacoplado de GameScene.
 *
 * - Soporta evaluación secuencial o semilibre.
 * - Se alimenta desde JSON.
 * - Registra qué salidas ya fueron evaluadas.
 * - Expone outcomes de combate, narrativa y estado de ruta.
 */
export class ExitEvaluationSystem {
  private readonly config: ExitEvaluationConfig;
  private readonly callbacks: ExitEvaluationCallbacks;
  private readonly runtimeByExitId: Map<string, RuntimeExitEvaluation>;
  private readonly orderedExitIds: string[];
  private backtrackSatisfied: boolean;
  private currentRouteState?: ExitEvaluationRouteState;

  static fromJson(config: ExitEvaluationConfig, callbacks: ExitEvaluationCallbacks = {}): ExitEvaluationSystem {
    return new ExitEvaluationSystem(config, callbacks);
  }

  constructor(config: ExitEvaluationConfig, callbacks: ExitEvaluationCallbacks = {}) {
    this.validateConfig(config);
    this.config = config;
    this.callbacks = callbacks;
    this.runtimeByExitId = new Map(
      config.exits.map((entry) => [
        entry.id,
        {
          config: entry,
          evaluated: false
        }
      ])
    );

    this.orderedExitIds = config.orderedExitIds ?? config.exits.map((entry) => entry.id);
    this.backtrackSatisfied = !config.openAfterBacktrackFromExitId;
  }

  markBacktrackFromExit(exitId: string): void {
    if (!this.config.openAfterBacktrackFromExitId) {
      this.backtrackSatisfied = true;
      return;
    }

    if (exitId === this.config.openAfterBacktrackFromExitId) {
      this.backtrackSatisfied = true;
    }
  }

  getSnapshot(): ExitEvaluationSnapshot {
    const evaluatedExitIds = this.orderedExitIds.filter((exitId) => this.runtimeByExitId.get(exitId)?.evaluated);
    const pendingExitIds = this.orderedExitIds.filter((exitId) => !this.runtimeByExitId.get(exitId)?.evaluated);

    return {
      levelId: this.config.levelId,
      mode: this.config.mode,
      backtrackSatisfied: this.backtrackSatisfied,
      evaluatedExitIds,
      pendingExitIds,
      currentRouteState: this.currentRouteState
    };
  }

  getEvaluatedExitIds(): string[] {
    return this.getSnapshot().evaluatedExitIds;
  }

  canEvaluateExit(exitId: string): boolean {
    if (!this.backtrackSatisfied) {
      return false;
    }

    const runtime = this.runtimeByExitId.get(exitId);
    if (!runtime || runtime.evaluated) {
      return false;
    }

    if (this.config.mode === 'sequential') {
      const expectedNext = this.getNextSequentialExitId();
      if (expectedNext !== exitId) {
        return false;
      }
    }

    const requirements = runtime.config.requiresEvaluated ?? [];
    return requirements.every((requiredExitId) => this.runtimeByExitId.get(requiredExitId)?.evaluated);
  }

  evaluateExit(exitId: string): ExitEvaluationResult {
    if (!this.canEvaluateExit(exitId)) {
      throw new Error(`ExitEvaluationSystem: la salida "${exitId}" no está disponible para evaluación.`);
    }

    const runtime = this.runtimeByExitId.get(exitId);
    if (!runtime) {
      throw new Error(`ExitEvaluationSystem: salida "${exitId}" no existe en la configuración.`);
    }

    runtime.evaluated = true;
    this.currentRouteState = runtime.config.routeState;

    const casualties = this.calculateCasualties(runtime.config.outcomes);

    const result: ExitEvaluationResult = {
      exitId,
      exitLabel: runtime.config.label,
      outcomes: [...runtime.config.outcomes],
      routeState: runtime.config.routeState,
      casualties,
      snapshot: this.getSnapshot()
    };

    this.callbacks.onExitEvaluated?.(result);
    return result;
  }

  private getNextSequentialExitId(): string | undefined {
    return this.orderedExitIds.find((exitId) => !this.runtimeByExitId.get(exitId)?.evaluated);
  }

  private calculateCasualties(outcomes: ExitEvaluationOutcome[]): { irreversibleLoss: number } {
    const irreversibleLoss = outcomes.reduce((sum, outcome) => {
      if (outcome.type !== 'narrative') {
        return sum;
      }

      const loss = Number(outcome.payload?.irreversibleLoss ?? 0);
      if (Number.isNaN(loss) || loss < 0) {
        return sum;
      }

      return sum + loss;
    }, 0);

    return { irreversibleLoss };
  }

  private validateConfig(config: ExitEvaluationConfig): void {
    if (!config.levelId.trim()) {
      throw new Error('ExitEvaluationSystem: levelId es obligatorio.');
    }

    if (!['sequential', 'semi_free'].includes(config.mode)) {
      throw new Error('ExitEvaluationSystem: mode debe ser "sequential" o "semi_free".');
    }

    if (!Array.isArray(config.exits) || config.exits.length === 0) {
      throw new Error('ExitEvaluationSystem: exits debe contener al menos una salida.');
    }

    const exitIds = new Set<string>();

    config.exits.forEach((entry) => {
      if (!entry.id.trim()) {
        throw new Error('ExitEvaluationSystem: cada salida requiere id no vacío.');
      }

      if (exitIds.has(entry.id)) {
        throw new Error(`ExitEvaluationSystem: id de salida duplicado "${entry.id}".`);
      }

      exitIds.add(entry.id);

      if (!entry.label.trim()) {
        throw new Error(`ExitEvaluationSystem: la salida "${entry.id}" requiere label.`);
      }

      if (!Array.isArray(entry.outcomes) || entry.outcomes.length === 0) {
        throw new Error(`ExitEvaluationSystem: la salida "${entry.id}" requiere outcomes.`);
      }

      if (!entry.routeState?.stateId?.trim()) {
        throw new Error(`ExitEvaluationSystem: la salida "${entry.id}" requiere routeState.stateId.`);
      }
    });

    if (config.orderedExitIds) {
      const unknownIds = config.orderedExitIds.filter((exitId) => !exitIds.has(exitId));
      if (unknownIds.length > 0) {
        throw new Error(`ExitEvaluationSystem: orderedExitIds contiene salidas desconocidas: ${unknownIds.join(', ')}.`);
      }
    }

    const requiredIds = config.exits.flatMap((entry) => entry.requiresEvaluated ?? []);
    const unknownRequirements = requiredIds.filter((requiredId) => !exitIds.has(requiredId));
    if (unknownRequirements.length > 0) {
      throw new Error(
        `ExitEvaluationSystem: requiresEvaluated contiene salidas desconocidas: ${unknownRequirements.join(', ')}.`
      );
    }
  }
}
