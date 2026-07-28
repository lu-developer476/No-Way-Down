import { LevelProgressionConfig, LevelProgressionZoneConfig } from './LevelProgressionSystem';
import { Level5CombatZone, Level5Section, Level5ThirdFloorConfig } from './Level5ThirdFloorTypes';

export type Level5ProgressionStepType = 'advance' | 'clear' | 'exit';

export interface Level5ProgressionStepJson {
  id: string;
  label: string;
  type: Level5ProgressionStepType;
  sectionMatcher: string;
  combatZoneMatcher?: string;
  lockBlockers?: string[];
  unlockBlockers?: string[];
  hintOnActivate?: string;
  hintOnComplete?: string;
}

export interface Level5ProgressionJsonConfig {
  blockerThickness?: number;
  blockerPadding?: number;
  steps: Level5ProgressionStepJson[];
}

export interface Level5ResolvedProgressionStep {
  id: string;
  label: string;
  type: Level5ProgressionStepType;
  sectionId: string;
  zoneId: string;
}

export interface Level5ProgressionBuild {
  config: LevelProgressionConfig;
  resolvedSteps: Level5ResolvedProgressionStep[];
}

const DEFAULT_BLOCKER_THICKNESS = 48;
const DEFAULT_BLOCKER_PADDING = 120;

function compileMatcher(rawPattern: string, context: string): RegExp {
  try {
    return new RegExp(rawPattern, 'i');
  } catch {
    throw new Error(`Level5Progression: invalid matcher in ${context}: "${rawPattern}".`);
  }
}

function resolveSection(step: Level5ProgressionStepJson, sections: Level5Section[]): Level5Section {
  const sectionMatcher = compileMatcher(step.sectionMatcher, `step "${step.id}" sectionMatcher`);
  const matchedSection = sections.find((section) => sectionMatcher.test(section.name));

  if (!matchedSection) {
    throw new Error(
      `Level5Progression: could not resolve section for step "${step.id}" with matcher "${step.sectionMatcher}".`
    );
  }

  return matchedSection;
}

function resolveCombatZone(
  step: Level5ProgressionStepJson,
  section: Level5Section,
  combatZones: Level5CombatZone[]
): Level5CombatZone {
  const sectionCombatZones = combatZones.filter((zone) => zone.section_id === section.id);
  if (sectionCombatZones.length === 0) {
    throw new Error(`Level5Progression: step "${step.id}" has no combat zones in section "${section.id}".`);
  }

  if (!step.combatZoneMatcher) {
    if (sectionCombatZones.length > 1) {
      throw new Error(
        `Level5Progression: step "${step.id}" needs combatZoneMatcher because section "${section.id}" has multiple combat zones.`
      );
    }

    return sectionCombatZones[0];
  }

  const zoneMatcher = compileMatcher(step.combatZoneMatcher, `step "${step.id}" combatZoneMatcher`);
  const matchedZone = sectionCombatZones.find((zone) => zoneMatcher.test(zone.name));

  if (!matchedZone) {
    throw new Error(
      `Level5Progression: step "${step.id}" could not resolve combat zone with matcher "${step.combatZoneMatcher}".`
    );
  }

  return matchedZone;
}

function buildCombatZoneProgression(step: Level5ProgressionStepJson, zone: Level5CombatZone): LevelProgressionZoneConfig {
  return {
    id: step.id,
    trigger: zone.area,
    lockBlockers: step.lockBlockers ?? [],
    unlockBlockers: step.unlockBlockers ?? step.lockBlockers ?? [],
    hintOnActivate: step.hintOnActivate ?? `Objetivo activo: ${step.label}.`,
    hintOnComplete: step.hintOnComplete ?? `Objetivo completado: ${step.label}.`,
    spawnWaves: zone.waves.map((wave) => ({
      enemyType: 'zombie',
      count: wave.enemies,
      spawnPoints: [{ x: zone.area.x, y: zone.area.y }],
      metadata: {
        sourceWave: wave.wave,
        sourceCombatZoneId: zone.id,
        sourceSectionId: zone.section_id
      }
    }))
  };
}

function buildNavigationProgression(
  step: Level5ProgressionStepJson,
  section: Level5Section,
  blockerThickness: number,
  blockerPadding: number
): { blocker: { id: string; bounds: { x: number; y: number; width: number; height: number } }; zone: LevelProgressionZoneConfig } {
  const blockerId = `${step.id}-blocker`;

  return {
    blocker: {
      id: blockerId,
      bounds: {
        x: section.bounds.x + section.bounds.width + blockerThickness / 2,
        y: section.bounds.y,
        width: blockerThickness,
        height: section.bounds.height + blockerPadding
      }
    },
    zone: {
      id: step.id,
      trigger: section.bounds,
      lockBlockers: step.lockBlockers ?? [blockerId],
      unlockBlockers: step.unlockBlockers ?? [blockerId],
      hintOnActivate: step.hintOnActivate ?? `Objetivo activo: ${step.label}.`,
      hintOnComplete: step.hintOnComplete ?? `Objetivo completado: ${step.label}.`,
      spawnWaves: [
        {
          enemyType: 'none',
          count: 0,
          spawnPoints: [section.entry_point]
        }
      ]
    }
  };
}

export function createLevel5ProgressionConfig(
  levelConfig: Level5ThirdFloorConfig,
  progressionJson: Level5ProgressionJsonConfig
): Level5ProgressionBuild {
  if (progressionJson.steps.length === 0) {
    throw new Error('Level5Progression: progression JSON must define at least one step.');
  }

  const blockerThickness = progressionJson.blockerThickness ?? DEFAULT_BLOCKER_THICKNESS;
  const blockerPadding = progressionJson.blockerPadding ?? DEFAULT_BLOCKER_PADDING;

  const blockers: LevelProgressionConfig['blockers'] = [];
  const zones: LevelProgressionConfig['zones'] = [];
  const resolvedSteps: Level5ResolvedProgressionStep[] = [];

  progressionJson.steps.forEach((step) => {
    const section = resolveSection(step, levelConfig.sections);
    let sourceZoneId = section.id;

    if (step.type === 'clear') {
      const combatZone = resolveCombatZone(step, section, levelConfig.combat_zones);
      sourceZoneId = combatZone.id;
      zones.push(buildCombatZoneProgression(step, combatZone));
    } else {
      const navigationProgression = buildNavigationProgression(step, section, blockerThickness, blockerPadding);
      blockers.push(navigationProgression.blocker);
      zones.push(navigationProgression.zone);
    }

    resolvedSteps.push({
      id: step.id,
      label: step.label,
      type: step.type,
      sectionId: section.id,
      zoneId: sourceZoneId
    });
  });

  return {
    config: {
      blockers,
      zones
    },
    resolvedSteps
  };
}

export const DEFAULT_LEVEL5_PROGRESSION_JSON: Level5ProgressionJsonConfig = {
  steps: [
    {
      id: 'nivel5-subir-escaleras',
      label: 'Subir escaleras',
      type: 'advance',
      sectionMatcher: 'acceso\\s+por\\s+escaleras|acceso\\s+al\\s+piso'
    },
    {
      id: 'nivel5-limpiar-corredor',
      label: 'Limpiar corredor',
      type: 'clear',
      sectionMatcher: 'corredor\\s+inicial',
      combatZoneMatcher: 'corredor\\s+inicial|presi[oó]n\\s+en\\s+corredor\\s+inicial'
    },
    {
      id: 'nivel5-limpiar-galeria',
      label: 'Limpiar galería',
      type: 'clear',
      sectionMatcher: 'galer[ií]a',
      combatZoneMatcher: 'galer[ií]a'
    },
    {
      id: 'nivel5-limpiar-oficinas',
      label: 'Limpiar oficinas',
      type: 'clear',
      sectionMatcher: 'oficinas|administrativo',
      combatZoneMatcher: 'administrativo|oficinas'
    },
    {
      id: 'nivel5-limpiar-corredor-final',
      label: 'Limpiar corredor final',
      type: 'clear',
      sectionMatcher: 'corredor\\s+final',
      combatZoneMatcher: 'tramo\\s+final|extracci[oó]n|corredor\\s+final'
    },
    {
      id: 'nivel5-llegar-salida',
      label: 'Llegar a salida',
      type: 'exit',
      sectionMatcher: 'salida\\s+del\\s+nivel'
    }
  ]
};
