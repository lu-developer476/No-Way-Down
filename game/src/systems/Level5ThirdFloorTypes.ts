export interface LevelPoint {
  x: number;
  y: number;
}

export interface LevelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Level5Section {
  id: string;
  name: string;
  description: string;
  bounds: LevelBounds;
  entry_point: LevelPoint;
  path_hint?: LevelPoint[];
}

export interface Level5SpawnPoint {
  id: string;
  section_id: string;
  position: LevelPoint;
  enemy_type: 'walker' | 'runner' | 'crawler' | 'brute';
  max_active: number;
}

export interface Level5CombatTrigger {
  type: 'cross_line' | 'enter_area' | 'objective_progress';
  action: string;
  position?: LevelPoint;
  radius?: number;
  line?: {
    from: LevelPoint;
    to: LevelPoint;
  };
  condition?: string;
}

export interface Level5CombatWave {
  wave: number;
  spawns: string[];
  enemies: number;
}

export interface Level5CombatZone {
  id: string;
  name: string;
  section_id: string;
  area: LevelBounds;
  activation_trigger: Level5CombatTrigger;
  clear_condition: {
    type: 'eliminate_enemies';
    count: number;
  };
  waves: Level5CombatWave[];
}

export interface Level5CoverObject {
  id: string;
  section_id: string;
  position: LevelPoint;
  size: {
    width: number;
    height: number;
  };
  cover_type: 'half' | 'full';
  asset_placeholder: string;
}

export interface Level5ExitPoint {
  id: string;
  position: LevelPoint;
  interaction_radius: number;
  destination_level: string;
  unlock_condition: 'all_combat_zones_cleared';
}

export interface Level5ThirdFloorConfig {
  level_name: string;
  sections: Level5Section[];
  spawn_points: Level5SpawnPoint[];
  combat_zones: Level5CombatZone[];
  cover_objects: Level5CoverObject[];
  exit_point: Level5ExitPoint;
}
