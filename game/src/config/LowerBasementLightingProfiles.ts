export interface LowerBasementLightingProfile {id:string;ambientTint:number;ambientAlpha:number;practicalLights:number;emergencyLights:number;fogDensity:number;steamDensity:number;dustDensity:number;reflectionStrength:number;shadowStrength:number;flickerProbability:number;exposure:number;wetSurfaceStrength:number;audioLoops:readonly string[]}
const p=(id:string,values:Partial<LowerBasementLightingProfile>):LowerBasementLightingProfile=>({id,ambientTint:0x9bb6b3,ambientAlpha:.38,practicalLights:12,emergencyLights:3,fogDensity:.08,steamDensity:.05,dustDensity:.04,reflectionStrength:.18,shadowStrength:.58,flickerProbability:.08,exposure:1,wetSurfaceStrength:.22,audioLoops:['electrical-hum','drips'],...values});
export const LOWER_BASEMENT_LIGHTING_PROFILES:Readonly<Record<string,LowerBasementLightingProfile>>=Object.freeze({
 'lower-basement-service':p('lower-basement-service',{}),
 'timed-descent-emergency':p('timed-descent-emergency',{ambientTint:0x7e9292,emergencyLights:8,flickerProbability:.2,audioLoops:['alarm','pipes','metal']}),
 'subsoil-three-flooded':p('subsoil-three-flooded',{ambientTint:0x6f8987,steamDensity:.22,reflectionStrength:.42,wetSurfaceStrength:.55,audioLoops:['drips','pipes','echo']}),
 'exit-security-check':p('exit-security-check',{practicalLights:16,emergencyLights:5,audioLoops:['electrical-hum','ventilation']}),
 'parking-garage-industrial':p('parking-garage-industrial',{practicalLights:24,fogDensity:.14,shadowStrength:.7,audioLoops:['ventilation','distant-engine','metal']}),
 'garage-damage-zone':p('garage-damage-zone',{ambientTint:0x9b7568,steamDensity:.18,flickerProbability:.28,audioLoops:['ventilation','metal']}),
 'garage-gate-exterior':p('garage-gate-exterior',{ambientTint:0xb5b8a5,ambientAlpha:.5,fogDensity:.06,audioLoops:['ventilation','exterior-near-gate']})
});
export function lowerBasementLightingProfile(id:string):LowerBasementLightingProfile|undefined{return LOWER_BASEMENT_LIGHTING_PROFILES[id]}
