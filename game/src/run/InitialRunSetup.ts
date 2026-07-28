export const INITIAL_SETUP_STORAGE_KEY = 'nwd.setup.initial';
export const INITIAL_SETUP_VERSION = 1 as const;

export type PlayableProtagonist = 'alan' | 'giovanna';
export type GameDifficulty = 'complejo' | 'pesadilla';

export interface InitialRunSetup {
  protagonist: PlayableProtagonist;
  difficulty: GameDifficulty;
  party: { required: string[]; optional: string[] };
  startedAt: string;
  version: typeof INITIAL_SETUP_VERSION;
}

const protagonist = (value: unknown): PlayableProtagonist | null => {
  if (value === 'alan' || value === 'alan-nahuel' || value === 'alanNahuel') return 'alan';
  return value === 'giovanna' ? value : null;
};

export function validateInitialRunSetup(value: unknown): InitialRunSetup | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<InitialRunSetup>;
  const selectedProtagonist = protagonist(candidate.protagonist);
  if (!selectedProtagonist || (candidate.difficulty !== 'complejo' && candidate.difficulty !== 'pesadilla')) return null;
  if (!Array.isArray(candidate.party?.required) || !Array.isArray(candidate.party.optional)) return null;
  const normalizeParty = (members: unknown[]) => [...new Set(members.filter((member): member is string => typeof member === 'string' && member.trim().length > 0))];
  return {
    protagonist: selectedProtagonist,
    difficulty: candidate.difficulty,
    party: { required: normalizeParty(candidate.party.required), optional: normalizeParty(candidate.party.optional) },
    startedAt: typeof candidate.startedAt === 'string' && candidate.startedAt ? candidate.startedAt : new Date().toISOString(),
    version: INITIAL_SETUP_VERSION
  };
}

export function saveInitialRunSetup(setup: InitialRunSetup): void {
  const valid = validateInitialRunSetup(setup);
  if (!valid) throw new Error('Invalid initial run setup');
  localStorage.setItem(INITIAL_SETUP_STORAGE_KEY, JSON.stringify(valid));
}

export function loadInitialRunSetup(): InitialRunSetup | null {
  const raw = localStorage.getItem(INITIAL_SETUP_STORAGE_KEY);
  if (!raw) return null;
  try { return validateInitialRunSetup(JSON.parse(raw)); } catch { return null; }
}

export function clearInitialRunSetup(): void {
  localStorage.removeItem(INITIAL_SETUP_STORAGE_KEY);
}
