export interface PlayerProgressPayload {
  user_id: string;
  current_level: string;
  life: number;
  allies_rescued: number;
  checkpoint: string;
  save_version?: number;
  campaign_snapshot?: CampaignSnapshot;
}

export interface CampaignSnapshot {
  setup: {
    protagonist: string;
    difficulty: string;
    initial_party: {
      required: string[];
      optional: string[];
    };
  };
  party: {
    active: string[];
    dead: string[];
    rescued: string[];
    infected: string[];
  };
  progress: {
    level: string;
    checkpoint: string;
    segment?: string;
    life: number;
    allies_rescued: number;
  };
  narrative: {
    flags: Record<string, string | number | boolean>;
    irreversible_events: string[];
    seen_cinematics: string[];
  };
  checkpoints: {
    last: string;
    visited: string[];
  };
}

export interface PlayerProgressResponse extends PlayerProgressPayload {
  updated_at: string;
  created_at: string;
}

const backendBaseUrl = import.meta.env.VITE_BACKEND_URL?.trim() ?? '';

const buildUrl = (path: string): string => `${backendBaseUrl.replace(/\/$/, '')}${path}`;

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const errorBody = await response.json() as { detail?: string };
    return errorBody.detail ?? `Error HTTP ${response.status}`;
  } catch {
    return `Error HTTP ${response.status}`;
  }
};

const isBackendConfigured = (): boolean => backendBaseUrl.length > 0;

const makeUnavailableError = (context: 'save' | 'load'): Error => {
  const action = context === 'save' ? 'guardar' : 'cargar';
  return new Error(`Servidor no disponible para ${action} progreso.`);
};

export const progressApi = {
  async saveProgress(payload: PlayerProgressPayload): Promise<PlayerProgressResponse> {
    if (!isBackendConfigured()) {
      throw makeUnavailableError('save');
    }

    try {
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
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw makeUnavailableError('save');
    }
  },

  async loadProgress(userId: string): Promise<PlayerProgressResponse> {
    if (!isBackendConfigured()) {
      throw makeUnavailableError('load');
    }

    try {
      const response = await fetch(buildUrl(`/api/progress/${encodeURIComponent(userId)}/`));

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }

      return response.json() as Promise<PlayerProgressResponse>;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw makeUnavailableError('load');
    }
  }
};
