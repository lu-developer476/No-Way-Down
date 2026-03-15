export type InteractableKind = 'vehicle' | 'object';

export interface InteractableDefinition {
  id: string;
  label: string;
  kind: InteractableKind;
  decorative: boolean;
  interactable: boolean;
  breakable?: boolean;
  locked?: boolean;
  loot?: Record<string, boolean>;
  usableForEscape?: boolean;
}

export interface InteractableRuntime {
  id: string;
  inspected: boolean;
  opened: boolean;
  locked: boolean;
  forcedOpen: boolean;
  lootCollected: Record<string, boolean>;
  escapeReady: boolean;
}

export type InteractableOutcome = 'inspected' | 'blocked' | 'opened' | 'forced-open' | 'escape-ready';

export class InteractableSystem {
  private readonly definitions = new Map<string, InteractableDefinition>();
  private readonly runtime = new Map<string, InteractableRuntime>();

  constructor(definitions: InteractableDefinition[]) {
    definitions.forEach((definition) => {
      this.definitions.set(definition.id, definition);
      this.runtime.set(definition.id, {
        id: definition.id,
        inspected: false,
        opened: definition.decorative,
        locked: definition.locked ?? false,
        forcedOpen: false,
        lootCollected: {},
        escapeReady: false
      });
    });
  }

  interact(id: string): { outcome: InteractableOutcome; runtime?: InteractableRuntime } {
    const definition = this.definitions.get(id);
    const runtime = this.runtime.get(id);
    if (!definition || !runtime) {
      return { outcome: 'blocked' };
    }

    runtime.inspected = true;
    if (!definition.interactable || definition.decorative) {
      return { outcome: 'inspected', runtime: { ...runtime, lootCollected: { ...runtime.lootCollected } } };
    }

    if (runtime.locked) {
      return { outcome: 'blocked', runtime: { ...runtime, lootCollected: { ...runtime.lootCollected } } };
    }

    runtime.opened = true;
    runtime.lootCollected = { ...(definition.loot ?? {}) };
    runtime.escapeReady = Boolean(definition.usableForEscape);

    return {
      outcome: runtime.escapeReady ? 'escape-ready' : 'opened',
      runtime: { ...runtime, lootCollected: { ...runtime.lootCollected } }
    };
  }

  forceOpen(id: string): { outcome: InteractableOutcome; runtime?: InteractableRuntime } {
    const definition = this.definitions.get(id);
    const runtime = this.runtime.get(id);
    if (!definition || !runtime) {
      return { outcome: 'blocked' };
    }

    if (!runtime.locked) {
      return this.interact(id);
    }

    if (!definition.breakable) {
      return { outcome: 'blocked', runtime: { ...runtime, lootCollected: { ...runtime.lootCollected } } };
    }

    runtime.locked = false;
    runtime.forcedOpen = true;
    const result = this.interact(id);
    if (!result.runtime) {
      return { outcome: 'blocked' };
    }

    return {
      outcome: result.runtime.escapeReady ? 'escape-ready' : 'forced-open',
      runtime: result.runtime
    };
  }

  getSnapshot(): InteractableRuntime[] {
    return [...this.runtime.values()].map((entry) => ({ ...entry, lootCollected: { ...entry.lootCollected } }));
  }
}
