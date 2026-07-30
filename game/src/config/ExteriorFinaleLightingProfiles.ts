export interface ExteriorFinaleLightingProfile {
  skyTint: number; ambientTint: number; ambientAlpha: number;
  streetLights: number; vehicleLights: number; fireLights: number; windowLights: number;
  fogDensity: number; smokeDensity: number; dustDensity: number; shadowStrength: number;
  reflectionStrength: number; exposure: number; flicker: boolean; transitionDuration: number;
}
const profile = (values: Partial<ExteriorFinaleLightingProfile>): ExteriorFinaleLightingProfile => ({
  skyTint: 0x253745, ambientTint: 0xa8a192, ambientAlpha: .72, streetLights: 8,
  vehicleLights: 2, fireLights: 1, windowLights: 7, fogDensity: .08, smokeDensity: .12,
  dustDensity: .1, shadowStrength: .45, reflectionStrength: .22, exposure: 1,
  flicker: false, transitionDuration: 900, ...values
});
export const EXTERIOR_FINALE_LIGHTING_PROFILES = {
  'plaza-de-mayo-transit': profile({ skyTint: 0x40515c, ambientAlpha: .8, streetLights: 12 }),
  'paseo-colon-abandoned': profile({ skyTint: 0x303e47, smokeDensity: .18, vehicleLights: 5 }),
  'independencia-street-hold': profile({ streetLights: 18, vehicleLights: 4, fireLights: 3, shadowStrength: .55 }),
  'post-battle-silence': profile({ ambientAlpha: .62, smokeDensity: .22, dustDensity: .16, transitionDuration: 1800 }),
  'san-telmo-arrival': profile({ skyTint: 0x242d36, streetLights: 10, windowLights: 4, fogDensity: .14 }),
  'san-telmo-radio': profile({ ambientTint: 0x8fa79d, streetLights: 6, windowLights: 2, flicker: true }),
  'open-ending': profile({ skyTint: 0x171d25, ambientAlpha: .55, fogDensity: .18, transitionDuration: 2400 })
} as const;
