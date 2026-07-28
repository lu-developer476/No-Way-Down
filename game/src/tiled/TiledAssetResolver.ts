import type { TiledMap } from './TiledTypes';
export interface LevelAsset { key:string; path:string; global:boolean }
export class TiledAssetResolver { resolve(map:TiledMap):LevelAsset[]{const values=Object.fromEntries(map.properties.map(p=>[p.name,p.value]));const path=values.runtimeBackgroundPath;return typeof path==='string'&&path?[{key:`level:${values.runtimeLevelId}:background`,path,global:false}]:[]} }
