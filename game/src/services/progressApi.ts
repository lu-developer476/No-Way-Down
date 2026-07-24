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
    flow_node_id?: string;
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

const normalizeApiPath = (path: string): string => `/${path.replace(/^\/+/, '')}`;

const buildUrl = (path: string): string => {
  const normalizedPath = normalizeApiPath(path);

  if (backendBaseUrl.length === 0) {
    return normalizedPath;
  }

  return `${backendBaseUrl.replace(/\/+$/, '')}${normalizedPath}`;
};

const parseErrorMessage = async (response: Response): Promise<string> => {
  try {
    const errorBody = await response.json() as { detail?: string };
    return errorBody.detail ?? `Error HTTP ${response.status}`;
  } catch {
    return `Error HTTP ${response.status}`;
  }
};

const makeUnavailableError = (context: 'save' | 'load'): Error => {
  const action = context === 'save' ? 'guardar' : 'cargar';
  return new Error(`Servidor no disponible para ${action} progreso.`);
};

export const progressApi = {
  async saveProgress(payload: PlayerProgressPayload): Promise<PlayerProgressResponse> {
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
