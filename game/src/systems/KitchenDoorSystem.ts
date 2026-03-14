export type KitchenDoorState = 'closed' | 'open' | 'broken';

export interface KitchenDoorVector2 {
  x: number;
  y: number;
}

export interface KitchenDoorSize {
  width: number;
  height: number;
}

export interface KitchenDoorCollision {
  shape: 'rectangle';
  offset: KitchenDoorVector2;
  isBlocking: boolean;
}

export interface KitchenDoorDefinition {
  id: string;
  position: KitchenDoorVector2;
  size: KitchenDoorSize;
  collision: KitchenDoorCollision;
  state?: KitchenDoorState;
  autoOpenRadius?: number;
  pushesToBreak?: number;
}

interface RuntimeKitchenDoorDefinition extends KitchenDoorDefinition {
  state: KitchenDoorState;
}

export interface KitchenDoorActor {
  position: KitchenDoorVector2;
}

interface KitchenDoorRuntimeState {
  definition: RuntimeKitchenDoorDefinition;
  pushesTaken: number;
}

const DEFAULT_AUTO_OPEN_RADIUS = 72;
const DEFAULT_PUSHES_TO_BREAK = 3;

export class KitchenDoorSystem {
  private readonly doors = new Map<string, KitchenDoorRuntimeState>();

  constructor(definitions: KitchenDoorDefinition[]) {
    definitions.forEach((definition) => {
      const runtimeDefinition: RuntimeKitchenDoorDefinition = {
        ...definition,
        state: definition.state ?? 'closed'
      };

      this.doors.set(runtimeDefinition.id, {
        definition: runtimeDefinition,
        pushesTaken: 0
      });

      this.syncBlockingWithState(runtimeDefinition);
    });
  }

  getDoor(id: string): KitchenDoorDefinition | undefined {
    return this.doors.get(id)?.definition;
  }

  getAllDoors(): KitchenDoorDefinition[] {
    return Array.from(this.doors.values(), (entry) => entry.definition);
  }

  blocksPassage(doorId: string): boolean {
    const runtime = this.getRuntimeOrThrow(doorId);
    return runtime.definition.collision.isBlocking;
  }

  canActorPassAtPosition(position: KitchenDoorVector2): boolean {
    return this.getBlockingDoorAtPosition(position) === undefined;
  }

  getBlockingDoorAtPosition(position: KitchenDoorVector2): KitchenDoorDefinition | undefined {
    for (const runtime of this.doors.values()) {
      if (!runtime.definition.collision.isBlocking) {
        continue;
      }

      if (this.isPointInsideCollision(position, runtime.definition)) {
        return runtime.definition;
      }
    }

    return undefined;
  }

  updateAutomaticOpening(actors: KitchenDoorActor[]): void {
    for (const runtime of this.doors.values()) {
      const door = runtime.definition;
      if (door.state === 'broken') {
        continue;
      }

      const shouldOpen = actors.some((actor) => this.isActorWithinAutoOpenRange(actor.position, door));
      door.state = shouldOpen ? 'open' : 'closed';
      this.syncBlockingWithState(door);
    }
  }

  pushByZombie(doorId: string, pushes = 1): KitchenDoorState {
    const runtime = this.getRuntimeOrThrow(doorId);
    const door = runtime.definition;

    if (door.state === 'broken') {
      return door.state;
    }

    runtime.pushesTaken += Math.max(0, pushes);

    if (runtime.pushesTaken >= (door.pushesToBreak ?? DEFAULT_PUSHES_TO_BREAK)) {
      door.state = 'broken';
    }

    this.syncBlockingWithState(door);
    return door.state;
  }

  setState(doorId: string, state: KitchenDoorState): KitchenDoorState {
    const runtime = this.getRuntimeOrThrow(doorId);
    runtime.definition.state = state;

    if (state === 'broken') {
      runtime.pushesTaken = runtime.definition.pushesToBreak ?? DEFAULT_PUSHES_TO_BREAK;
    }

    this.syncBlockingWithState(runtime.definition);
    return runtime.definition.state;
  }

  private syncBlockingWithState(door: KitchenDoorDefinition): void {
    door.collision.isBlocking = door.state === 'closed';
  }

  private isActorWithinAutoOpenRange(actor: KitchenDoorVector2, door: KitchenDoorDefinition): boolean {
    const centerX = door.position.x + door.collision.offset.x;
    const centerY = door.position.y + door.collision.offset.y;
    const radius = door.autoOpenRadius ?? DEFAULT_AUTO_OPEN_RADIUS;
    const dx = actor.x - centerX;
    const dy = actor.y - centerY;

    return dx * dx + dy * dy <= radius * radius;
  }

  private isPointInsideCollision(point: KitchenDoorVector2, door: KitchenDoorDefinition): boolean {
    const halfWidth = door.size.width * 0.5;
    const halfHeight = door.size.height * 0.5;
    const centerX = door.position.x + door.collision.offset.x;
    const centerY = door.position.y + door.collision.offset.y;

    return (
      point.x >= centerX - halfWidth
      && point.x <= centerX + halfWidth
      && point.y >= centerY - halfHeight
      && point.y <= centerY + halfHeight
    );
  }

  private getRuntimeOrThrow(doorId: string): KitchenDoorRuntimeState {
    const runtime = this.doors.get(doorId);
    if (!runtime) {
      throw new Error(`Kitchen door not found: ${doorId}`);
    }

    return runtime;
  }
}
