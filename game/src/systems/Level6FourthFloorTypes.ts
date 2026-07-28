export interface Level6Point {
  x: number;
  y: number;
}

export interface Level6Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Level6SizedObject {
  width: number;
  height: number;
}

export interface Level6Obstacle {
  id: string;
  type: string;
  position: Level6Point;
  size: Level6SizedObject;
  asset_placeholder: string;
}

export interface Level6InteractiveObject {
  id: string;
  type: string;
  position: Level6Point;
  interaction_radius: number;
  action: string;
  asset_placeholder: string;
}

export interface Level6Section {
  id: string;
  name: string;
  description: string;
  bounds: Level6Bounds;
  entry_point: Level6Point;
  path_hint?: Level6Point[];
  extraction_pad?: {
    x: number;
    y: number;
    radius: number;
  };
  obstacles: Level6Obstacle[];
  interactive_objects: Level6InteractiveObject[];
  landmarks?: string[];
}

export interface Level6SpawnPoint {
  id: string;
  section_id: string;
  position: Level6Point;
  enemy_type: 'walker' | 'runner' | 'crawler' | 'brute';
  max_active: number;
}

export interface Level6CombatTrigger {
  type: 'cross_line' | 'enter_area' | 'objective_progress';
  action: string;
  position?: Level6Point;
  radius?: number;
  line?: {
    from: Level6Point;
    to: Level6Point;
  };
  condition?: string;
}

export interface Level6CombatWave {
  wave: number;
  spawns: string[];
  enemies: number;
}

export interface Level6CombatZone {
  id: string;
  name: string;
  section_id: string;
  area: Level6Bounds;
  activation_trigger: Level6CombatTrigger;
  clear_condition: {
    type: 'eliminate_enemies';
    count: number;
  };
  waves: Level6CombatWave[];
}

export interface Level6CoverObject {
  id: string;
  section_id: string;
  position: Level6Point;
  size: Level6SizedObject;
  cover_type: 'half' | 'full';
  asset_placeholder: string;
}

export interface Level6ExitPoint {
  id: string;
  position: Level6Point;
  interaction_radius: number;
  destination_level: string;
  unlock_condition: 'all_combat_zones_cleared';
}

export interface Level6FourthFloorConfig {
  level_name: string;
  sections: Level6Section[];
  spawn_points: Level6SpawnPoint[];
  combat_zones: Level6CombatZone[];
  cover_objects: Level6CoverObject[];
  exit_point: Level6ExitPoint;
}
