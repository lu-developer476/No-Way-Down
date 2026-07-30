/** Authorial connector metadata; campaign order remains owned by the canonical manifest. */
export type LowerLevelTransitionType = 'stairs-down'|'stairs-up'|'service-door'|'security-door'|'garage-gate'|'exterior-gate';
export interface LowerLevelConnector {
  sourceNodeId:string; sourceRuntimeLevelId:string; sourceFloor:number; sourceConnectorId:string;
  sourceDirection:'up'|'down'|'horizontal'|'exterior'; targetNodeId:string; targetRuntimeLevelId:string;
  targetFloor:number; targetSpawnId:string; transitionType:LowerLevelTransitionType;
}
export const LOWER_LEVEL_CONNECTORS:readonly LowerLevelConnector[]=Object.freeze([
 {sourceNodeId:'lvl08-esc01-descenso-con-temporizador',sourceRuntimeLevelId:'level_8_pasillo_subsuelo2_escaleras_subsuelo3',sourceFloor:-2,sourceConnectorId:'escalera-subsuelo-3',sourceDirection:'down',targetNodeId:'lvl08-cin01-damian-infectado-y-suicidio',targetRuntimeLevelId:'level_9_verificacion_salidas',targetFloor:-3,targetSpawnId:'lvl09-esc01-verificacion-salidas-player-spawn',transitionType:'stairs-down'},
 {sourceNodeId:'lvl09-esc01-verificacion-salidas',sourceRuntimeLevelId:'level_9_verificacion_salidas',sourceFloor:-3,sourceConnectorId:'salida-e-garage',sourceDirection:'horizontal',targetNodeId:'lvl09-cin01-hallazgo-salida-y-mordida-selene',targetRuntimeLevelId:'level_9_subsuelo3_garage_salida',targetFloor:-3,targetSpawnId:'lvl10-esc01-garage-busqueda-vehiculo-player-spawn',transitionType:'security-door'},
 {sourceNodeId:'lvl10-esc01-garage-busqueda-vehiculo',sourceRuntimeLevelId:'level_9_subsuelo3_garage_salida',sourceFloor:-3,sourceConnectorId:'abordar-sedan',sourceDirection:'horizontal',targetNodeId:'lvl10-cin01-hallazgo-del-vehiculo',targetRuntimeLevelId:'level_9_subsuelo3_garage_salida',targetFloor:-3,targetSpawnId:'lvl10-esc02-resistencia-en-garage-player-spawn',transitionType:'garage-gate'},
 {sourceNodeId:'lvl10-esc02-resistencia-en-garage',sourceRuntimeLevelId:'level_9_subsuelo3_garage_salida',sourceFloor:-3,sourceConnectorId:'garage-exterior-gate',sourceDirection:'exterior',targetNodeId:'lvl10-cin02-salida-del-garage',targetRuntimeLevelId:'level_10_exterior_urbano',targetFloor:0,targetSpawnId:'lvl10-esc01-combate-50-bajas-en-via-publica-player-spawn',transitionType:'exterior-gate'}
]);
export function validateLowerLevelConnector(c:LowerLevelConnector):boolean {
 if(!c.sourceConnectorId||!c.targetSpawnId||!c.targetNodeId)return false;
 if(c.transitionType==='stairs-down')return c.targetFloor<c.sourceFloor;
 if(c.transitionType==='stairs-up')return c.targetFloor>c.sourceFloor;
 if(c.transitionType==='exterior-gate')return c.sourceFloor<0&&c.targetFloor===0;
 return c.targetFloor===c.sourceFloor;
}
