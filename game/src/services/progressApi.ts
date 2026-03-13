export interface PlayerProgressPayload {
  user_id: string;
  current_level: string;
  life: number;
  allies_rescued: number;
  checkpoint: string;
}

export interface PlayerProgressResponse extends PlayerProgressPayload {
  updated_at: string;
  created_at: string;
}

const backendBaseUrl = import.meta.env.VITE_BACKEND_URL;

if (!backendBaseUrl) {
  throw new Error('Falta configurar VITE_BACKEND_URL para conectar con el backend.');
}

const buildUrl = (path: string): string => `${backendBaseUrl.replace(/\/$/, '')}${path}`;

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const errorBody = await response.json() as { detail?: string };
    return errorBody.detail ?? `Error HTTP ${response.status}`;
  } catch {
    return `Error HTTP ${response.status}`;
  }
};

export const progressApi = {
  async saveProgress(payload: PlayerProgressPayload): Promise<PlayerProgressResponse> {
    const response = await fetch(buildUrl('/api/progress/'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    return response.json() as Promise<PlayerProgressResponse>;
  },

  async loadProgress(userId: string): Promise<PlayerProgressResponse> {
    const response = await fetch(buildUrl(`/api/progress/${encodeURIComponent(userId)}/`));

    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }

    return response.json() as Promise<PlayerProgressResponse>;
  }
};
