import level1Runtime from '../../../public/assets/levels/runtime/level_1_subsuelo_comedor.runtime.json';
import level2Runtime from '../../../public/assets/levels/runtime/level_2_subsuelo.runtime.json';
import level3Runtime from '../../../public/assets/levels/runtime/level_3_upper_floor.runtime.json';
import { LevelDefinition, LevelManager } from './LevelManager';

export interface CampaignLevelEntry {
  id: string;
  levelConfigPath: string;
}

export const CAMPAIGN_LEVEL_SEQUENCE: CampaignLevelEntry[] = [
  { id: 'level-2-subsuelo', levelConfigPath: 'assets/levels/level2_subsuelo.json' },
  { id: 'level-3-planta-baja', levelConfigPath: 'assets/levels/level3_hall_planta_baja.json' },
  { id: 'level-4-segundo-piso', levelConfigPath: 'assets/levels/level4_segundo_piso.json' },
  { id: 'level-5-tercer-piso', levelConfigPath: 'assets/levels/level5_tercer_piso.json' },
  { id: 'level-6-comedor', levelConfigPath: 'assets/levels/level6_cuarto_piso_comedor.json' },
  { id: 'level-7-quinto-piso', levelConfigPath: 'assets/levels/level7_quinto_piso.json' },
  { id: 'level-8-office-422', levelConfigPath: 'assets/levels/level8_office422_rescue.json' },
  { id: 'level-9-descent-pressure', levelConfigPath: 'assets/levels/level9_descent_pressure.json' },
  { id: 'level-10-vehicle-loot', levelConfigPath: 'assets/levels/level10_vehicle_loot.json' },
  { id: 'level-10-parking-survival', levelConfigPath: 'assets/levels/level10_parking_survival.json' }
];

const runtimeLevels: LevelDefinition[] = [
  level1Runtime as unknown as LevelDefinition,
  level2Runtime as unknown as LevelDefinition,
  level3Runtime as unknown as LevelDefinition
];

export const levelManager = new LevelManager(runtimeLevels);
