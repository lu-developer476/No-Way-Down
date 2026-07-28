export type DoorState = 'closed' | 'open' | 'locked' | 'destroyed';

export interface Vector2 {
  x: number;
  y: number;
}

export interface DoorSize {
  width: number;
  height: number;
}

export interface DoorCollision {
  shape: 'rectangle';
  offset: Vector2;
  isBlocking: boolean;
}

export interface DoorDurability {
  maxHp: number;
  destroyedAtHp?: number;
}

export interface DoorDefinition {
  id: string;
  position: Vector2;
  size: DoorSize;
  collision: DoorCollision;
  state: DoorState;
  durability?: DoorDurability;
}

interface DoorRuntimeState {
  definition: DoorDefinition;
  hp: number;
}

export class DoorSystem {
  private readonly doors = new Map<string, DoorRuntimeState>();

  constructor(definitions: DoorDefinition[]) {
    definitions.forEach((definition) => {
      this.doors.set(definition.id, {
        definition,
        hp: definition.durability?.maxHp ?? 1
      });

      this.syncBlockingWithState(definition);
    });
  }

  getDoor(id: string): DoorDefinition | undefined {
    return this.doors.get(id)?.definition;
  }

  getAllDoors(): DoorDefinition[] {
    return Array.from(this.doors.values(), (entry) => entry.definition);
  }

  blocksPassage(doorId: string): boolean {
    const runtime = this.getRuntimeOrThrow(doorId);
    return runtime.definition.collision.isBlocking;
  }

  canActorPassAtPosition(actorPosition: Vector2): boolean {
    return this.getBlockingDoorAtPosition(actorPosition) === undefined;
  }

  getBlockingDoorAtPosition(actorPosition: Vector2): DoorDefinition | undefined {
    for (const runtime of this.doors.values()) {
      if (!runtime.definition.collision.isBlocking) {
        continue;
      }

      if (this.isPointInsideCollision(actorPosition, runtime.definition)) {
        return runtime.definition;
      }
    }

    return undefined;
  }

  openDoor(doorId: string): DoorState {
    const runtime = this.getRuntimeOrThrow(doorId);
    if (runtime.definition.state === 'destroyed' || runtime.definition.state === 'locked') {
      return runtime.definition.state;
    }

    runtime.definition.state = 'open';
    this.syncBlockingWithState(runtime.definition);
    return runtime.definition.state;
  }

  closeDoor(doorId: string): DoorState {
    const runtime = this.getRuntimeOrThrow(doorId);
    if (runtime.definition.state === 'destroyed') {
      return runtime.definition.state;
    }

    runtime.definition.state = 'closed';
    this.syncBlockingWithState(runtime.definition);
    return runtime.definition.state;
  }

  lockDoor(doorId: string): DoorState {
    const runtime = this.getRuntimeOrThrow(doorId);
    if (runtime.definition.state === 'destroyed') {
      return runtime.definition.state;
    }

    runtime.definition.state = 'locked';
    this.syncBlockingWithState(runtime.definition);
    return runtime.definition.state;
  }

  unlockDoor(doorId: string): DoorState {
    const runtime = this.getRuntimeOrThrow(doorId);
    if (runtime.definition.state !== 'locked') {
      return runtime.definition.state;
    }

    runtime.definition.state = 'closed';
    this.syncBlockingWithState(runtime.definition);
    return runtime.definition.state;
  }

  setState(doorId: string, state: DoorState): DoorState {
    const runtime = this.getRuntimeOrThrow(doorId);
    runtime.definition.state = state;

    if (state === 'destroyed') {
      const destroyedAtHp = runtime.definition.durability?.destroyedAtHp ?? 0;
      runtime.hp = Math.min(runtime.hp, destroyedAtHp);
    }

    this.syncBlockingWithState(runtime.definition);
    return runtime.definition.state;
  }

  applyZombieDamage(doorId: string, damage: number): DoorState {
    const runtime = this.getRuntimeOrThrow(doorId);
    if (runtime.definition.state === 'destroyed') {
      return runtime.definition.state;
    }

    if (!runtime.definition.durability) {
      return runtime.definition.state;
    }

    const destroyedAtHp = runtime.definition.durability.destroyedAtHp ?? 0;
    runtime.hp = Math.max(destroyedAtHp, runtime.hp - Math.max(0, damage));

    if (runtime.hp <= destroyedAtHp) {
      runtime.definition.state = 'destroyed';
      this.syncBlockingWithState(runtime.definition);
    }

    return runtime.definition.state;
  }

  getDoorHp(doorId: string): number {
    return this.getRuntimeOrThrow(doorId).hp;
  }

  private syncBlockingWithState(door: DoorDefinition): void {
    door.collision.isBlocking = door.state === 'closed' || door.state === 'locked';
  }

  private isPointInsideCollision(point: Vector2, definition: DoorDefinition): boolean {
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

  private getRuntimeOrThrow(doorId: string): DoorRuntimeState {
    const runtime = this.doors.get(doorId);
    if (!runtime) {
      throw new Error(`Door not found: ${doorId}`);
    }

    return runtime;
  }
}
