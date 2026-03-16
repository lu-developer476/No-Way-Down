import level2Runtime from '../../../public/assets/levels/runtime/level_2_subsuelo.runtime.json';
import level3Runtime from '../../../public/assets/levels/runtime/level_3_upper_floor.runtime.json';
import { LevelDefinition, LevelManager } from './LevelManager';

const levels: LevelDefinition[] = [
  level2Runtime as unknown as LevelDefinition,
  level3Runtime as unknown as LevelDefinition
];

export const levelManager = new LevelManager(levels);
