export type CombatProfileId = 'resistance-small'|'corridor-pressure'|'hall-clearance'|'office-sweep'|'floor-ambush'|'rescue-pressure'|'timed-descent-pursuit'|'exit-verification'|'garage-search'|'garage-defense'|'street-horde'|'san-telmo-approach'|'none';
export interface CombatProfile { id: CombatProfileId; combatExpected: boolean; reason: string; spawnSystemIds: readonly string[]; }
export const combatProfiles: Readonly<Record<string, CombatProfile>> = Object.freeze({
  'lvl01-esc01-comedor-resistencia': {id:'resistance-small',combatExpected:true,reason:'La resistencia inicial establece la amenaza.',spawnSystemIds:['runtime-spawn-manager']},
  'lvl01-esc02-pasillos-hacia-escaleras-pb': {id:'corridor-pressure',combatExpected:true,reason:'Los pasillos sostienen la presión durante la retirada.',spawnSystemIds:['runtime-spawn-manager']},
  'lvl02-esc01-hall-planta-baja': {id:'hall-clearance',combatExpected:true,reason:'El grupo debe asegurar el hall.',spawnSystemIds:['runtime-spawn-manager']},
  'lvl03-esc01-segundo-piso': {id:'floor-ambush',combatExpected:true,reason:'Emboscada al alcanzar el segundo piso.',spawnSystemIds:['runtime-spawn-manager']},
  'lvl04-esc01-tercer-piso': {id:'floor-ambush',combatExpected:true,reason:'Amenazas bloquean la búsqueda del tercer piso.',spawnSystemIds:['runtime-spawn-manager']},
  'lvl05-esc01-cuarto-piso-comedor': {id:'office-sweep',combatExpected:true,reason:'Barrido del comedor y oficinas.',spawnSystemIds:['runtime-spawn-manager']},
  'lvl06-esc01-quinto-piso-pertenencias': {id:'floor-ambush',combatExpected:true,reason:'La recuperación de pertenencias atrae infectados.',spawnSystemIds:['runtime-spawn-manager']},
  'lvl07-esc01-oficina-422-rescate': {id:'rescue-pressure',combatExpected:true,reason:'El rescate debe ejecutarse bajo presión.',spawnSystemIds:['runtime-spawn-manager']},
  'lvl08-esc01-descenso-con-temporizador': {id:'timed-descent-pursuit',combatExpected:true,reason:'Los perseguidores refuerzan la urgencia del descenso.',spawnSystemIds:['runtime-spawn-manager']},
  'lvl09-esc01-verificacion-salidas': {id:'exit-verification',combatExpected:true,reason:'Encuentros breves separan la inspección de salidas.',spawnSystemIds:['runtime-spawn-manager']},
  'lvl10-esc01-garage-busqueda-vehiculo': {id:'garage-search',combatExpected:true,reason:'La búsqueda del vehículo alerta infectados.',spawnSystemIds:['runtime-spawn-manager']},
  'lvl10-esc02-resistencia-en-garage': {id:'garage-defense',combatExpected:true,reason:'La resistencia del garage requiere oleadas.',spawnSystemIds:['runtime-spawn-manager']},
  'lvl10-esc01-combate-50-bajas-en-via-publica': {id:'street-horde',combatExpected:true,reason:'El combate final exige una horda.',spawnSystemIds:['runtime-spawn-manager']},
  'lvl10-esc03-llegada-a-san-telmo': {id:'san-telmo-approach',combatExpected:true,reason:'La aproximación conserva una última amenaza acotada.',spawnSystemIds:['runtime-spawn-manager']}
});
export function requireCombatProfile(nodeId: string): CombatProfile { const profile=combatProfiles[nodeId]; if(!profile) throw new Error(`Nodo level sin perfil de combate explícito: ${nodeId}`); return profile; }
