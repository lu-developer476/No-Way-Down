export interface CampaignStateData {
  currentLevel: string;
  narrativeProgress: Record<string, string | number | boolean>;
  activeCharacters: string[];
  deadCharacters: string[];
  rescuedCharacters: string[];
  infectedCharacters: string[];
  irreversibleEvents: string[];
  globalResources: Record<string, number>;
  seenCinematics: string[];
}

export interface CampaignStatePatch {
  currentLevel?: string;
  narrativeProgress?: Record<string, string | number | boolean>;
  addActiveCharacter?: string;
  removeActiveCharacter?: string;
  markDeadCharacter?: string;
  markRescuedCharacter?: string;
  markInfectedCharacter?: string;
  markIrreversibleEvent?: string;
  addResource?: { id: string; delta: number };
  markCinematicSeen?: string;
}

export class CampaignState {
  private state: CampaignStateData;

  constructor(initialLevel: string, seed: Partial<CampaignStateData> = {}) {
    this.state = {
      currentLevel: initialLevel,
      narrativeProgress: { ...(seed.narrativeProgress ?? {}) },
      activeCharacters: [...(seed.activeCharacters ?? [])],
      deadCharacters: [...(seed.deadCharacters ?? [])],
      rescuedCharacters: [...(seed.rescuedCharacters ?? [])],
      infectedCharacters: [...(seed.infectedCharacters ?? [])],
      irreversibleEvents: [...(seed.irreversibleEvents ?? [])],
      globalResources: { ...(seed.globalResources ?? {}) },
      seenCinematics: [...(seed.seenCinematics ?? [])]
    };
  }

  applyPatch(patch: CampaignStatePatch): CampaignStateData {
    if (patch.currentLevel) {
      this.state.currentLevel = patch.currentLevel;
    }

    if (patch.narrativeProgress) {
      this.state.narrativeProgress = {
        ...this.state.narrativeProgress,
        ...patch.narrativeProgress
      };
    }

    this.addUnique(this.state.activeCharacters, patch.addActiveCharacter);

    if (patch.removeActiveCharacter) {
      this.state.activeCharacters = this.state.activeCharacters.filter((id) => id !== patch.removeActiveCharacter);
    }

    if (patch.markDeadCharacter) {
      this.addUnique(this.state.deadCharacters, patch.markDeadCharacter);
      this.state.activeCharacters = this.state.activeCharacters.filter((id) => id !== patch.markDeadCharacter);
    }

    this.addUnique(this.state.rescuedCharacters, patch.markRescuedCharacter);
    this.addUnique(this.state.infectedCharacters, patch.markInfectedCharacter);
    this.addUnique(this.state.irreversibleEvents, patch.markIrreversibleEvent);
    this.addUnique(this.state.seenCinematics, patch.markCinematicSeen);

    if (patch.addResource) {
      const current = this.state.globalResources[patch.addResource.id] ?? 0;
      this.state.globalResources[patch.addResource.id] = current + patch.addResource.delta;
    }

    return this.getSnapshot();
  }

  getSnapshot(): CampaignStateData {
    return {
      currentLevel: this.state.currentLevel,
      narrativeProgress: { ...this.state.narrativeProgress },
      activeCharacters: [...this.state.activeCharacters],
      deadCharacters: [...this.state.deadCharacters],
      rescuedCharacters: [...this.state.rescuedCharacters],
      infectedCharacters: [...this.state.infectedCharacters],
      irreversibleEvents: [...this.state.irreversibleEvents],
      globalResources: { ...this.state.globalResources },
      seenCinematics: [...this.state.seenCinematics]
    };
  }

  private addUnique(collection: string[], value?: string): void {
    if (!value || collection.includes(value)) {
      return;
    }

    collection.push(value);
  }
}
