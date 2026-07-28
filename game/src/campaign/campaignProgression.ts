import type { InteractableDefinition } from '../systems/core/InteractableSystem.ts';
import type { LevelDefinition } from '../systems/level/LevelManager.ts';
import type { LevelWorldDefinition, WorldConnector } from '../world/LevelWorldDefinition.ts';

export interface RuntimeGeometry {
  width: number;
  height: number;
  floorHeight: number;
  floorY: number;
  worldWidthMismatch: boolean;
  worldHeightMismatch: boolean;
}

/** Gameplay geometry always comes from the runtime level, never presentation metadata. */
export function resolveRuntimeGeometry(level: LevelDefinition, visual?: LevelWorldDefinition): RuntimeGeometry {
  const width = level.layout.width;
  const height = level.layout.height;
  const floorHeight = level.layout.floor_height ?? 64;
  return Object.freeze({
    width,
    height,
    floorHeight,
    floorY: height - floorHeight / 2,
    worldWidthMismatch: visual !== undefined && visual.worldWidth !== width,
    worldHeightMismatch: visual !== undefined && visual.worldHeight !== height
  });
}

export interface ResistanceSnapshot { active: boolean; completed: boolean; remainingMs: number }

/** Small deterministic state machine shared by runtime diagnostics and tests. */
export class ResistanceClock {
  private completed = false;
  private completionCount = 0;
  readonly startedAt: number;
  readonly durationMs: number;
  constructor(startedAt: number, durationMs: number) {
    this.startedAt=startedAt;
    this.durationMs=durationMs;
    if (!Number.isFinite(durationMs) || durationMs <= 0) throw new Error('Resistance duration must be positive.');
  }
  tick(now: number, onComplete?: () => void): ResistanceSnapshot {
    const remainingMs = Math.max(0, this.startedAt + this.durationMs - now);
    if (remainingMs === 0 && !this.completed) {
      this.completed = true;
      this.completionCount += 1;
      onComplete?.();
    }
    return Object.freeze({ active: !this.completed, completed: this.completed, remainingMs });
  }
  get completions(): number { return this.completionCount; }
}

export interface MappedConnector extends WorldConnector {
  existingInteractionId: string;
  existingExitId: string;
  enabled: boolean;
  objectiveRequirementSatisfied: boolean;
}

export function mapExitConnectors(
  definition: LevelWorldDefinition,
  runtime: LevelDefinition,
  objectiveRequirementSatisfied: boolean
): MappedConnector[] {
  const exitInteractions = runtime.interactables.filter((item) => {
    const effect = item.interactionEffect;
    return Boolean(effect.targetId && runtime.exits.some((exit) => exit.id === effect.targetId));
  });
  // Objective-driven encounters transition through their mission runtime and
  // intentionally have no door/vehicle interaction to map.
  if (runtime.exits.length === 0 && exitInteractions.length === 0) return [];
  if (exitInteractions.length !== definition.exitConnectors.length) {
    throw new Error(`${definition.nodeId}: connector/interaction count mismatch (${definition.exitConnectors.length}/${exitInteractions.length}).`);
  }
  return definition.exitConnectors.map((connector, index) => {
    const interaction: InteractableDefinition = exitInteractions[index];
    const existingExitId = interaction.interactionEffect.targetId;
    if (!existingExitId) throw new Error(`${definition.nodeId}: connector has no canonical exit.`);
    return {
      ...connector,
      x: interaction.x,
      y: interaction.y,
      interactionId: interaction.id,
      existingInteractionId: interaction.id,
      existingExitId,
      enabled: interaction.enabled ?? true,
      objectiveRequirementSatisfied
    };
  });
}
