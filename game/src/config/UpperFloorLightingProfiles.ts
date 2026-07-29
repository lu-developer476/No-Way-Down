export interface UpperFloorLightingProfile {ambientTint:number;ambientAlpha:number;practicalLights:number;emergencyLights:number;fogDensity:number;dustDensity:number;reflectionStrength:number;shadowStrength:number;flicker:boolean;exposure:number}
export const UPPER_FLOOR_LIGHTING_PROFILES:Readonly<Record<string,UpperFloorLightingProfile>>={
 'second-floor-administrative':{ambientTint:0x9eb6b5,ambientAlpha:.16,practicalLights:12,emergencyLights:2,fogDensity:.02,dustDensity:.12,reflectionStrength:.18,shadowStrength:.28,flicker:false,exposure:1},
 'third-floor-emergency':{ambientTint:0x68747b,ambientAlpha:.2,practicalLights:7,emergencyLights:8,fogDensity:.08,dustDensity:.22,reflectionStrength:.08,shadowStrength:.42,flicker:true,exposure:.88},
 'fourth-floor-cafeteria':{ambientTint:0xd4c49b,ambientAlpha:.13,practicalLights:16,emergencyLights:3,fogDensity:.02,dustDensity:.09,reflectionStrength:.24,shadowStrength:.24,flicker:false,exposure:1.08},
 'fifth-floor-belongings':{ambientTint:0x9c876d,ambientAlpha:.18,practicalLights:9,emergencyLights:4,fogDensity:.05,dustDensity:.2,reflectionStrength:.1,shadowStrength:.36,flicker:true,exposure:.94},
 'office-422-focused':{ambientTint:0xc7a86f,ambientAlpha:.12,practicalLights:8,emergencyLights:2,fogDensity:.02,dustDensity:.1,reflectionStrength:.2,shadowStrength:.32,flicker:false,exposure:1.04},
 'stair-core-emergency':{ambientTint:0x6e7c82,ambientAlpha:.22,practicalLights:4,emergencyLights:10,fogDensity:.1,dustDensity:.25,reflectionStrength:.06,shadowStrength:.45,flicker:true,exposure:.84}
};
