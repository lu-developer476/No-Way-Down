export type PartyControlMode = 'human' | 'ai';
export type PartyMemberStatus = 'active' | 'dead' | 'rescued' | 'infected' | 'removed';

export interface PartyMemberNarrativeState {
  deathPending: boolean;
  deathCause?: string;
}

export interface PartyMember {
  id: string;
  name: string;
  characterId?: string;
  controlMode: PartyControlMode;
  status: PartyMemberStatus;
  permanentlyLost: boolean;
  narrative: PartyMemberNarrativeState;
}

export class PartyStateSystem {
  private readonly members = new Map<string, PartyMember>();

  constructor(seed: PartyMember[] = []) {
    seed.forEach((member) => this.members.set(member.id, this.normalizeMember(member)));
  }

  upsertMember(member: PartyMember): void {
    this.members.set(member.id, this.normalizeMember(member));
  }

  markDead(id: string): void {
    this.patch(id, { status: 'dead', permanentlyLost: true });
  }

  markRescued(id: string): void {
    this.patch(id, { status: 'rescued' });
  }

  markInfected(id: string): void {
    this.patch(id, { status: 'infected' });
  }

  markNarrativeDeathPending(id: string, deathCause?: string): void {
    const current = this.members.get(id);
    if (!current) {
      return;
    }

    this.members.set(id, {
      ...current,
      narrative: {
        ...current.narrative,
        deathPending: true,
        deathCause: deathCause ?? current.narrative.deathCause
      }
    });
  }

  clearNarrativeDeathPending(id: string): void {
    const current = this.members.get(id);
    if (!current) {
      return;
    }

    this.members.set(id, {
      ...current,
      narrative: {
        deathPending: false,
        deathCause: undefined
      }
    });
  }

  setControlMode(id: string, controlMode: PartyControlMode): void {
    this.patch(id, { controlMode });
  }

  removePermanently(id: string): void {
    this.patch(id, { status: 'removed', permanentlyLost: true });
  }

  getSnapshot(): PartyMember[] {
    return [...this.members.values()].map((member) => ({
      ...member,
      narrative: { ...member.narrative }
    }));
  }

  private patch(id: string, patch: Partial<PartyMember>): void {
    const current = this.members.get(id);
    if (!current) {
      return;
    }

    this.members.set(id, {
      ...current,
      ...patch,
      narrative: {
        ...current.narrative,
        ...patch.narrative
      }
    });
  }

  private normalizeMember(member: PartyMember): PartyMember {
    return {
      ...member,
      narrative: {
        deathPending: member.narrative?.deathPending ?? false,
        deathCause: member.narrative?.deathCause
      }
    };
  }
}
