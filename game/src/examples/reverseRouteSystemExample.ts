import level7Layout from '../../public/assets/levels/level7_quinto_piso.json';
import level8Rescue from '../../config/levels/level8/level8_rescate_oficina_422.json';
import { ReverseRouteConfig, ReverseRouteSystem } from '../systems/ReverseRouteSystem';

const reverseRouteConfig: ReverseRouteConfig = {
  sourceLevelId: 'level_07',
  targetLevelId: 'level_08_oficina_422',
  sourceSections: level7Layout.sections,
  sourceForwardFlow: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S10', 'S11'],
  anchorSectionId: 'S5',
  reuse: [
    {
      level8SectionId: 's02_reversa_sector_n7',
      level7SectionIds: ['S5', 'S4', 'S3', 'S2']
    }
  ],
  initialRoutes: level8Rescue.sections
    .find((section) => section.id === 's02_reversa_sector_n7')
    ?.route_options ?? [],
  routePair: {
    mainCorridorRouteId: 'ruta_pasillo_principal',
    internalOfficesRouteId: 'ruta_oficinas_internas'
  }
};

export function reverseRouteSystemExample() {
  const reverseRouteSystem = ReverseRouteSystem.fromJson(reverseRouteConfig);

  const mainCorridorPath = reverseRouteSystem.getCombinedPath('ruta_pasillo_principal');
  const internalOfficesPath = reverseRouteSystem.getCombinedPath('ruta_oficinas_internas');

  const mappedCombatZones = reverseRouteSystem.mapCombatZones(level7Layout.combat_zones);
  const mappedCheckpoints = reverseRouteSystem.mapCheckpoints([
    { id: 'checkpoint-dev', section_id: 'S3' },
    { id: 'checkpoint-comms', section_id: 'S5' }
  ]);

  return {
    snapshot: reverseRouteSystem.getSnapshot(),
    mainCorridorRoute: reverseRouteSystem.getMainCorridorRoute(),
    internalOfficesRoute: reverseRouteSystem.getInternalOfficesRoute(),
    mainCorridorPath,
    internalOfficesPath,
    mappedCombatZones,
    mappedCheckpoints
  };
}
