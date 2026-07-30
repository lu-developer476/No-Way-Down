export interface SanTelmoSignalSnapshot {
  cluesObserved: string[]; requiredClues: number; radioObserved: boolean; finalExitUnlocked: boolean;
}
/** Objective gate for the visible, Tiled-authored San Telmo clues and radio. */
export class SanTelmoSignalSystem {
  private readonly observed = new Set<string>();
  private radioObserved = false;
  private exitUnlocked = false;
  private readonly clueIds: readonly string[];
  private readonly requiredClues: number;
  constructor(clueIds: readonly string[], requiredClues = 4) {
    this.clueIds = clueIds;
    this.requiredClues = requiredClues;
    if (new Set(clueIds).size !== clueIds.length) throw new Error('San Telmo clue IDs must be unique.');
    if (requiredClues < 1 || requiredClues > clueIds.length) throw new Error('Invalid required clue count.');
  }
  observeClue(id: string): boolean {
    if (!this.clueIds.includes(id) || this.observed.has(id)) return false;
    this.observed.add(id); return true;
  }
  examineRadio(id: string): boolean {
    if (id !== 'radio-san-telmo' || this.radioObserved || this.observed.size < this.requiredClues) return false;
    this.radioObserved = true; this.exitUnlocked = true; return true;
  }
  canUseExit(id: string): boolean { return id === 'san-telmo-desenlace' && this.exitUnlocked; }
  snapshot(): SanTelmoSignalSnapshot {
    return { cluesObserved: [...this.observed], requiredClues: this.requiredClues, radioObserved: this.radioObserved, finalExitUnlocked: this.exitUnlocked };
  }
}
