export type CanonicalAction =
  | { type: 'exit-checked'; exitId: string; outcome: string }
  | { type: 'garage-clue-found'; clueId: string }
  | { type: 'vehicle-inspected'; vehicleId: string };

export interface Nodes19To27Snapshot {
  version: 1;
  descent: { durationMs: number; remainingMs: number; state: 'running' | 'paused' | 'won' | 'lost' };
  checkedExits: Record<string, string>;
  selectedExit?: string;
  garageClues: string[];
  inspectedVehicles: string[];
  vehicleFound: boolean;
}

const DESCENT_DURATION_MS = 180_000;
const REQUIRED_EXITS = ['salida-a', 'salida-b', 'salida-c', 'salida-d', 'salida-e'] as const;
const REQUIRED_GARAGE_CLUES = ['mapa-garage', 'llaves-suv'] as const;
const ESCAPE_VEHICLE = 'sedan-supervivencia';

/** Deterministic, serializable state for canonical gameplay nodes 19, 23 and 26. */
export class CanonicalNodes19To27Runtime {
  private state: Nodes19To27Snapshot;

  constructor(snapshot?: Nodes19To27Snapshot) {
    this.state = snapshot ? CanonicalNodes19To27Runtime.validate(snapshot) : this.freshState();
  }

  tick(deltaMs: number, blockedByPauseOrNarrative = false): Nodes19To27Snapshot {
    if (blockedByPauseOrNarrative || this.state.descent.state !== 'running') return this.getSnapshot();
    this.state.descent.remainingMs = Math.max(0, this.state.descent.remainingMs - Math.max(0, deltaMs));
    if (this.state.descent.remainingMs === 0) this.state.descent.state = 'lost';
    return this.getSnapshot();
  }

  pause(): void { if (this.state.descent.state === 'running') this.state.descent.state = 'paused'; }
  resume(): void { if (this.state.descent.state === 'paused') this.state.descent.state = 'running'; }
  completeDescent(): boolean {
    if (this.state.descent.state !== 'running' || this.state.descent.remainingMs === 0) return false;
    this.state.descent.state = 'won'; return true;
  }
  restartDescent(): void { this.state.descent = { durationMs: DESCENT_DURATION_MS, remainingMs: DESCENT_DURATION_MS, state: 'running' }; }

  apply(action: CanonicalAction): boolean {
    if (action.type === 'exit-checked') {
      if (!REQUIRED_EXITS.includes(action.exitId as typeof REQUIRED_EXITS[number]) || this.state.checkedExits[action.exitId]) return false;
      this.state.checkedExits[action.exitId] = action.outcome;
      if (REQUIRED_EXITS.every((id) => this.state.checkedExits[id])) this.state.selectedExit = 'salida-e-garage';
      return true;
    }
    if (action.type === 'garage-clue-found') {
      if (!REQUIRED_GARAGE_CLUES.includes(action.clueId as typeof REQUIRED_GARAGE_CLUES[number]) || this.state.garageClues.includes(action.clueId)) return false;
      this.state.garageClues.push(action.clueId); return true;
    }
    if (this.state.inspectedVehicles.includes(action.vehicleId)) return false;
    this.state.inspectedVehicles.push(action.vehicleId);
    this.state.vehicleFound = action.vehicleId === ESCAPE_VEHICLE && REQUIRED_GARAGE_CLUES.every((id) => this.state.garageClues.includes(id));
    return true;
  }

  canLeaveExitLevel(): boolean { return REQUIRED_EXITS.every((id) => Boolean(this.state.checkedExits[id])) && this.state.selectedExit === 'salida-e-garage'; }
  canStartVehicleCinematic(): boolean { return this.state.vehicleFound; }
  formatTimer(): string {
    const seconds = Math.ceil(this.state.descent.remainingMs / 1000);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }
  getSnapshot(): Nodes19To27Snapshot { return structuredClone(this.state); }
  serialize(): string { return JSON.stringify(this.state); }
  static deserialize(value: string): CanonicalNodes19To27Runtime { return new CanonicalNodes19To27Runtime(JSON.parse(value) as Nodes19To27Snapshot); }

  private freshState(): Nodes19To27Snapshot {
    return { version: 1, descent: { durationMs: DESCENT_DURATION_MS, remainingMs: DESCENT_DURATION_MS, state: 'running' }, checkedExits: {}, garageClues: [], inspectedVehicles: [], vehicleFound: false };
  }
  private static validate(snapshot: Nodes19To27Snapshot): Nodes19To27Snapshot {
    if (snapshot.version !== 1 || snapshot.descent.durationMs !== DESCENT_DURATION_MS || snapshot.descent.remainingMs < 0 || snapshot.descent.remainingMs > DESCENT_DURATION_MS) throw new Error('Snapshot canónico 19-27 inválido.');
    return structuredClone(snapshot);
  }
}
