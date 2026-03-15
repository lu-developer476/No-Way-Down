export type PartyControlMode = 'human' | 'ai';
export type PartyMemberStatus = 'active' | 'dead' | 'rescued' | 'infected' | 'removed';

export interface PartyMember {
  id: string;
  name: string;
  controlMode: PartyControlMode;
  status: PartyMemberStatus;
  permanentlyLost: boolean;
}

export class PartyStateSystem {
  private readonly members = new Map<string, PartyMember>();

  constructor(seed: PartyMember[] = []) {
    seed.forEach((member) => this.members.set(member.id, { ...member }));
  }

  upsertMember(member: PartyMember): void {
    this.members.set(member.id, { ...member });
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

  setControlMode(id: string, controlMode: PartyControlMode): void {
    this.patch(id, { controlMode });
  }

  removePermanently(id: string): void {
    this.patch(id, { status: 'removed', permanentlyLost: true });
  }

  getSnapshot(): PartyMember[] {
    return [...this.members.values()].map((member) => ({ ...member }));
  }

  private patch(id: string, patch: Partial<PartyMember>): void {
    const current = this.members.get(id);
    if (!current) {
      return;
    }

    this.members.set(id, {
      ...current,
      ...patch
    });
  }
}
