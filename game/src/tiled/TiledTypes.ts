export type TiledPropertyValue = string | number | boolean;
export interface TiledProperty { name: string; type: 'string'|'int'|'float'|'bool'|'file'; value: TiledPropertyValue }
export interface TiledPoint { x: number; y: number }
export interface TiledObject { id: number; name: string; type: string; x: number; y: number; width: number; height: number; rotation: number; visible: boolean; properties?: TiledProperty[]; polygon?: TiledPoint[]; polyline?: TiledPoint[]; image?: string }
export interface TiledObjectLayer { id: number; name: string; type: 'objectgroup'; visible: boolean; opacity: number; objects: TiledObject[]; properties?: TiledProperty[]; locked?: boolean }
export interface TiledMap { type: 'map'; version: string; width: number; height: number; tilewidth: number; tileheight: number; infinite: boolean; compressionlevel: number; layers: TiledObjectLayer[]; properties: TiledProperty[] }
export interface TiledLevelIdentity { nodeId: string; runtimeLevelId: string; mapPath: string }
