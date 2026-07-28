import { LevelProgressionConfig, LevelProgressionZoneConfig } from './LevelProgressionSystem';
import { Level6CombatZone, Level6FourthFloorConfig, Level6Section } from './Level6FourthFloorTypes';

export type Level6ProgressionStepType = 'advance' | 'clear' | 'exit';

export interface Level6ProgressionStepJson {
  id: string;
  label: string;
  type: Level6ProgressionStepType;
  sectionMatcher: string;
  combatZoneMatcher?: string;
  lockBlockers?: string[];
  unlockBlockers?: string[];
  hintOnActivate?: string;
  hintOnComplete?: string;
}

export interface Level6ProgressionJsonConfig {
  blockerThickness?: number;
  blockerPadding?: number;
  steps: Level6ProgressionStepJson[];
}

export interface Level6ResolvedProgressionStep {
  id: string;
  label: string;
  type: Level6ProgressionStepType;
  sectionId: string;
  zoneId: string;
}

export interface Level6ProgressionBuild {
  config: LevelProgressionConfig;
  resolvedSteps: Level6ResolvedProgressionStep[];
}

const DEFAULT_BLOCKER_THICKNESS = 56;
const DEFAULT_BLOCKER_PADDING = 120;

function compileMatcher(rawPattern: string, context: string): RegExp {
  try {
    return new RegExp(rawPattern, 'i');
  } catch {
    throw new Error(`Level6Progression: invalid matcher in ${context}: "${rawPattern}".`);
  }
}

function resolveSection(step: Level6ProgressionStepJson, sections: Level6Section[]): Level6Section {
  const sectionMatcher = compileMatcher(step.sectionMatcher, `step "${step.id}" sectionMatcher`);
  const matchedSection = sections.find((section) => sectionMatcher.test(section.name));

  if (!matchedSection) {
    throw new Error(
      `Level6Progression: could not resolve section for step "${step.id}" with matcher "${step.sectionMatcher}".`
    );
  }

  return matchedSection;
}

function resolveCombatZone(
  step: Level6ProgressionStepJson,
  section: Level6Section,
  combatZones: Level6CombatZone[]
): Level6CombatZone {
  const sectionCombatZones = combatZones.filter((zone) => zone.section_id === section.id);
  if (sectionCombatZones.length === 0) {
    throw new Error(`Level6Progression: step "${step.id}" has no combat zones in section "${section.id}".`);
  }

  if (!step.combatZoneMatcher) {
    if (sectionCombatZones.length > 1) {
      throw new Error(
        `Level6Progression: step "${step.id}" needs combatZoneMatcher because section "${section.id}" has multiple combat zones.`
      );
    }

    return sectionCombatZones[0];
  }

  const zoneMatcher = compileMatcher(step.combatZoneMatcher, `step "${step.id}" combatZoneMatcher`);
  const matchedZone = sectionCombatZones.find((zone) => zoneMatcher.test(zone.name));

  if (!matchedZone) {
    throw new Error(
      `Level6Progression: step "${step.id}" could not resolve combat zone with matcher "${step.combatZoneMatcher}".`
    );
  }

  return matchedZone;
}

function buildCombatZoneProgression(step: Level6ProgressionStepJson, zone: Level6CombatZone): LevelProgressionZoneConfig {
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
  step: Level6ProgressionStepJson,
  section: Level6Section,
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

export function createLevel6ProgressionConfig(
  levelConfig: Level6FourthFloorConfig,
  progressionJson: Level6ProgressionJsonConfig
): Level6ProgressionBuild {
  if (progressionJson.steps.length === 0) {
    throw new Error('Level6Progression: progression JSON must define at least one step.');
  }

  const blockerThickness = progressionJson.blockerThickness ?? DEFAULT_BLOCKER_THICKNESS;
  const blockerPadding = progressionJson.blockerPadding ?? DEFAULT_BLOCKER_PADDING;

  const blockers: LevelProgressionConfig['blockers'] = [];
  const zones: LevelProgressionConfig['zones'] = [];
  const resolvedSteps: Level6ResolvedProgressionStep[] = [];

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

export const DEFAULT_LEVEL6_PROGRESSION_JSON: Level6ProgressionJsonConfig = {
  steps: [
    {
      id: 'nivel6-subir-escaleras',
      label: 'Subir escaleras',
      type: 'advance',
      sectionMatcher: 'acceso\\s+por\\s+escaleras|acceso\\s+al\\s+piso'
    },
    {
      id: 'nivel6-limpiar-pasillo',
      label: 'Limpiar pasillo',
      type: 'clear',
      sectionMatcher: 'pasillo\\s+de\\s+servicio|pasillo',
      combatZoneMatcher: 'pasillo\\s+de\\s+servicio|pasillo'
    },
    {
      id: 'nivel6-limpiar-cocina',
      label: 'Limpiar cocina',
      type: 'clear',
      sectionMatcher: 'cocina\\s+industrial|cocina',
      combatZoneMatcher: 'cocina'
    },
    {
      id: 'nivel6-limpiar-area-preparacion',
      label: 'Limpiar área de preparación',
      type: 'clear',
      sectionMatcher: '[áa]rea\\s+de\\s+preparaci[oó]n',
      combatZoneMatcher: '[áa]rea\\s+de\\s+preparaci[oó]n|preparaci[oó]n'
    },
    {
      id: 'nivel6-limpiar-comedor',
      label: 'Limpiar comedor',
      type: 'clear',
      sectionMatcher: 'comedor\\s+de\\s+empleados|comedor',
      combatZoneMatcher: 'comedor'
    },
    {
      id: 'nivel6-llegar-salida',
      label: 'Salida',
      type: 'exit',
      sectionMatcher: 'salida'
    }
  ]
};
