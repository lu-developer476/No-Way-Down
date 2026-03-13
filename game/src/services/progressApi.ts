export interface PlayerProgressSnapshot {
  x: number;
  y: number;
  health: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface SaveProgressPayload {
  sceneKey: string;
  respawnPoint: Position;
  checkpoint?: Position;
  playerPositions: PlayerProgressSnapshot[];
  teamHealth: number;
  zombiesRemaining: number;
  currentObjective: string;
}

export interface LoadProgressPayload extends SaveProgressPayload {
  savedAt: string;
}

const resolveApiBaseUrl = (): string => {
  const baseUrl = import.meta.env.VITE_BACKEND_URL;

  if (!baseUrl || typeof baseUrl !== 'string') {
    throw new Error('VITE_BACKEND_URL no está configurado.');
  }

  return baseUrl.replace(/\/$/, '');
};

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const data = await response.json() as { detail?: string };
    return data.detail ?? `Error HTTP ${response.status}`;
  } catch {
    return `Error HTTP ${response.status}`;
  }
};

export const saveGameProgress = async (slotId: string, payload: SaveProgressPayload): Promise<LoadProgressPayload> => {
  const response = await fetch(`${resolveApiBaseUrl()}/api/progress/${slotId}/`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json() as Promise<LoadProgressPayload>;
};

export const loadGameProgress = async (slotId: string): Promise<LoadProgressPayload> => {
  const response = await fetch(`${resolveApiBaseUrl()}/api/progress/${slotId}/`);

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return response.json() as Promise<LoadProgressPayload>;
};
