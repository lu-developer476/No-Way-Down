export type TurnstileState = 'blocked' | 'unlocked' | 'destroyed';

export interface Vector2 {
  x: number;
  y: number;
}

export interface TurnstileSize {
  width: number;
  height: number;
}

export interface TurnstileCollision {
  shape: 'rectangle';
  offset: Vector2;
  isBlocking: boolean;
  blocksProjectiles?: boolean;
}

export interface TurnstileInteractionConfig {
  radius: number;
  holdToInteractMs: number;
  requiresCredential?: boolean;
  credentialTags?: string[];
}

export interface TurnstileDurability {
  maxHp: number;
  destroyedAtHp: number;
}

export interface TurnstileDefinition {
  id: string;
  position: Vector2;
  size: TurnstileSize;
  collision: TurnstileCollision;
  state: TurnstileState;
  interaction: TurnstileInteractionConfig;
  durability?: TurnstileDurability;
}

export interface ActorInteractionContext {
  actorPosition: Vector2;
  actorCredentials?: string[];
  interactionHeldMs?: number;
}

export interface InteractionResult {
  turnstileId: string;
  canInteract: boolean;
  canPass: boolean;
  blockedReason?: 'out_of_range' | 'state_blocked' | 'missing_credential';
  resultingState: TurnstileState;
}

interface TurnstileRuntimeState {
  definition: TurnstileDefinition;
  hp: number;
}

export class TurnstileSystem {
  private readonly turnstiles = new Map<string, TurnstileRuntimeState>();

  constructor(definitions: TurnstileDefinition[]) {
    definitions.forEach((definition) => {
      this.turnstiles.set(definition.id, {
        definition,
        hp: definition.durability?.maxHp ?? 1
      });
    });
  }

  getTurnstile(id: string): TurnstileDefinition | undefined {
    return this.turnstiles.get(id)?.definition;
  }

  getAllTurnstiles(): TurnstileDefinition[] {
    return Array.from(this.turnstiles.values(), (entry) => entry.definition);
  }

  canActorPassAtPosition(actorPosition: Vector2): boolean {
    return this.getBlockingTurnstileAtPosition(actorPosition) === undefined;
  }

  getBlockingTurnstileAtPosition(actorPosition: Vector2): TurnstileDefinition | undefined {
    for (const runtime of this.turnstiles.values()) {
      if (!runtime.definition.collision.isBlocking || runtime.definition.state !== 'blocked') {
        continue;
      }

      if (this.isPointInsideCollision(actorPosition, runtime.definition)) {
        return runtime.definition;
      }
    }

    return undefined;
  }

  evaluateInteraction(turnstileId: string, context: ActorInteractionContext): InteractionResult {
    const runtime = this.getRuntimeOrThrow(turnstileId);
    const definition = runtime.definition;

    if (!this.isWithinInteractionRadius(context.actorPosition, definition)) {
      return {
        turnstileId,
        canInteract: false,
        canPass: definition.state !== 'blocked',
        blockedReason: 'out_of_range',
        resultingState: definition.state
      };
    }

    if (definition.state === 'destroyed') {
      return {
        turnstileId,
        canInteract: true,
        canPass: true,
        resultingState: definition.state
      };
    }

    if (definition.state === 'unlocked') {
      return {
        turnstileId,
        canInteract: true,
        canPass: true,
        resultingState: definition.state
      };
    }

    if (!this.hasRequiredCredential(definition, context.actorCredentials)) {
      return {
        turnstileId,
        canInteract: true,
        canPass: false,
        blockedReason: 'missing_credential',
        resultingState: definition.state
      };
    }

    const heldMs = context.interactionHeldMs ?? 0;
    if (heldMs < definition.interaction.holdToInteractMs) {
      return {
        turnstileId,
        canInteract: true,
        canPass: false,
        blockedReason: 'state_blocked',
        resultingState: definition.state
      };
    }

    definition.state = 'unlocked';
    return {
      turnstileId,
      canInteract: true,
      canPass: true,
      resultingState: definition.state
    };
  }

  setState(turnstileId: string, state: TurnstileState): void {
    const runtime = this.getRuntimeOrThrow(turnstileId);
    runtime.definition.state = state;

    if (state === 'destroyed') {
      runtime.definition.collision.isBlocking = false;
      runtime.hp = Math.min(runtime.hp, runtime.definition.durability?.destroyedAtHp ?? 0);
    }
  }

  applyDamage(turnstileId: string, damage: number): TurnstileState {
    const runtime = this.getRuntimeOrThrow(turnstileId);
    if (!runtime.definition.durability || runtime.definition.state === 'destroyed') {
      return runtime.definition.state;
    }

    runtime.hp = Math.max(runtime.definition.durability.destroyedAtHp, runtime.hp - Math.max(0, damage));

    if (runtime.hp <= runtime.definition.durability.destroyedAtHp) {
      runtime.definition.state = 'destroyed';
      runtime.definition.collision.isBlocking = false;
    }

    return runtime.definition.state;
  }

  private isWithinInteractionRadius(actorPosition: Vector2, definition: TurnstileDefinition): boolean {
    const dx = actorPosition.x - definition.position.x;
    const dy = actorPosition.y - definition.position.y;
    return (dx * dx) + (dy * dy) <= definition.interaction.radius * definition.interaction.radius;
  }

  private hasRequiredCredential(definition: TurnstileDefinition, actorCredentials: string[] = []): boolean {
    if (!definition.interaction.requiresCredential) {
      return true;
    }

    const requiredTags = definition.interaction.credentialTags ?? [];
    if (requiredTags.length === 0) {
      return true;
    }

    return requiredTags.some((tag) => actorCredentials.includes(tag));
  }

  private isPointInsideCollision(point: Vector2, definition: TurnstileDefinition): boolean {
    const halfWidth = definition.size.width * 0.5;
    const halfHeight = definition.size.height * 0.5;
    const centerX = definition.position.x + definition.collision.offset.x;
    const centerY = definition.position.y + definition.collision.offset.y;

    return (
      point.x >= centerX - halfWidth
      && point.x <= centerX + halfWidth
      && point.y >= centerY - halfHeight
      && point.y <= centerY + halfHeight
    );
  }

  private getRuntimeOrThrow(turnstileId: string): TurnstileRuntimeState {
    const runtime = this.turnstiles.get(turnstileId);
    if (!runtime) {
      throw new Error(`Turnstile not found: ${turnstileId}`);
    }

    return runtime;
  }
}
