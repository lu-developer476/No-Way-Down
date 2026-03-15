export type CombatEventType =
  | 'zone-activated'
  | 'wave-started'
  | 'spawn-triggered'
  | 'zone-cleared'
  | 'combat-closed';

export interface CombatEvent {
  type: CombatEventType;
  zoneId: string;
  waveId?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface CombatZoneRuntime {
  zoneId: string;
  active: boolean;
  completed: boolean;
  activeWaveId?: string;
}

export class CombatEventSystem {
  private readonly zones = new Map<string, CombatZoneRuntime>();

  constructor(zoneIds: string[]) {
    zoneIds.forEach((zoneId) => {
      this.zones.set(zoneId, {
        zoneId,
        active: false,
        completed: false
      });
    });
  }

  applyEvent(event: CombatEvent): CombatZoneRuntime | undefined {
    const zone = this.zones.get(event.zoneId);
    if (!zone) {
      return undefined;
    }

    if (event.type === 'zone-activated') {
      zone.active = true;
      zone.completed = false;
      zone.activeWaveId = undefined;
    }

    if (event.type === 'wave-started') {
      zone.active = true;
      zone.activeWaveId = event.waveId;
    }

    if (event.type === 'zone-cleared' || event.type === 'combat-closed') {
      zone.active = false;
      zone.completed = true;
      zone.activeWaveId = undefined;
    }

    return { ...zone };
  }

  getSnapshot(): CombatZoneRuntime[] {
    return [...this.zones.values()].map((zone) => ({ ...zone }));
  }
}
