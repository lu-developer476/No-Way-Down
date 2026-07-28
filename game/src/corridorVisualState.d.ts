import type { CorridorSector } from './config/corridorEnvironmentComposition';
declare global { interface Window { __NWD_VISUAL_STATE__?: { nodeId:string; runtimeLevelId:string; environmentRenderer:string; legacyBackgroundActive:boolean; loadedEnvironmentAssetKeys:string[]; environmentObjectCount:number; architecturePrimitiveCount:number; foregroundObjectCount:number; lightCount:number; activeSector:CorridorSector; missingTextureCount:number; }; } }
export {};
