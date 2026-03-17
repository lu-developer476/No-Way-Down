import level1Runtime from '../../../public/assets/levels/runtime/level_1_subsuelo_comedor.runtime.json';
import level2Runtime from '../../../public/assets/levels/runtime/level_2_escaleras_espiral.runtime.json';
import level3Runtime from '../../../public/assets/levels/runtime/level_3_upper_floor.runtime.json';
import level4Runtime from '../../../public/assets/levels/runtime/level_4_oficina_422_comedor_escaleras.runtime.json';
import level5Runtime from '../../../public/assets/levels/runtime/level_5_oficinas_selene_descenso.runtime.json';
import level6Runtime from '../../../public/assets/levels/runtime/level_6_pasillos_planta_baja_salidas.runtime.json';
import level7Runtime from '../../../public/assets/levels/runtime/level_7_escaleras_subsuelo2_infectado.runtime.json';
import level8Runtime from '../../../public/assets/levels/runtime/level_8_pasillo_subsuelo2_escaleras_subsuelo3.runtime.json';
import level9Runtime from '../../../public/assets/levels/runtime/level_9_subsuelo3_garage_salida.runtime.json';
import level10Runtime from '../../../public/assets/levels/runtime/level_10_exterior_urbano.runtime.json';
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
  level3Runtime as unknown as LevelDefinition,
  level4Runtime as unknown as LevelDefinition,
  level5Runtime as unknown as LevelDefinition,
  level6Runtime as unknown as LevelDefinition,
  level7Runtime as unknown as LevelDefinition,
  level8Runtime as unknown as LevelDefinition,
  level9Runtime as unknown as LevelDefinition,
  level10Runtime as unknown as LevelDefinition
];

export const levelManager = new LevelManager(runtimeLevels);
