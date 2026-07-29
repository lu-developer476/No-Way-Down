import Phaser from 'phaser';
import {existingAsset,type VisualAssetRole} from '../visual/ExistingAssetCatalog';
import {TiledObjectParser} from './TiledObjectParser';
import type {TiledMap,TiledObject,TiledObjectLayer,TiledPropertyValue} from './TiledTypes';

export const VISUAL_LAYER_ROLES:Readonly<Record<string,VisualAssetRole>>={Background:'background',DistantArchitecture:'distantArchitecture',RearArchitecture:'rearArchitecture',Architecture:'architecture',RearProps:'rearProp',GameplayDecor:'gameplayDecor',FrontProps:'frontProp',Foreground:'foreground'};
const allowedProperties=new Set(['assetKey','depth','scrollFactorX','scrollFactorY','tint','alpha','blendMode','visualRole','occludesActors','lightAnchorId','reflectionStrength','editorOnly','runtimeOnly','qualityTier','sector','runtimeId','frame','anchor']);
export interface TiledVisualResult{objects:readonly Phaser.GameObjects.Image[];renderedLayerNames:readonly string[];backgroundObjectCount:number;architectureObjectCount:number;propObjectCount:number;foregroundObjectCount:number;missingAssetKeys:readonly string[];destroy():void}

function property(object:TiledObject,name:string):TiledPropertyValue|undefined{return TiledObjectParser.properties(object.properties??[])[name]}
function numeric(value:TiledPropertyValue|undefined,fallback:number):number{return typeof value==='number'?value:fallback}
function tint(value:TiledPropertyValue|undefined):number|undefined{if(typeof value==='number')return value;if(typeof value==='string'&&/^(0x|#)?[0-9a-f]{6}$/i.test(value))return Number.parseInt(value.replace(/^0x|^#/,''),16);return undefined}
function blendMode(value:TiledPropertyValue|undefined):Phaser.BlendModes|string|undefined{return typeof value==='string'?value:undefined}

export class TiledVisualRenderer{
 build(scene:Phaser.Scene,map:TiledMap):TiledVisualResult{const runtimeIds=new Set<string>();const objects:Phaser.GameObjects.Image[]=[],layers:string[]=[],missing=new Set<string>();let background=0,architecture=0,props=0,foreground=0;
  for(const layer of map.layers){const defaultRole=VISUAL_LAYER_ROLES[layer.name];if(!defaultRole||!layer.visible||propertyLayer(layer,'editorOnly')===true)continue;let rendered=false;
   for(const object of layer.objects){if(!object.visible||property(object,'editorOnly')===true||property(object,'runtimeOnly')===false)continue;for(const item of object.properties??[])if(!allowedProperties.has(item.name))throw new Error(`UNKNOWN_VISUAL_PROPERTY: ${layer.name}.${object.name}.${item.name}`);const runtimeId=property(object,'runtimeId');if(runtimeId!==undefined){if(typeof runtimeId!=='string'||runtimeId.trim().length===0)throw new Error(`INVALID_RUNTIME_ID: ${layer.name}.${object.name}`);if(runtimeIds.has(runtimeId))throw new Error(`DUPLICATE_RUNTIME_ID: ${runtimeId}`);runtimeIds.add(runtimeId)}const key=property(object,'assetKey');if(typeof key!=='string')throw new Error(`VISUAL_ASSET_KEY_REQUIRED: ${layer.name}.${object.name}`);const asset=existingAsset(key);if(!asset){missing.add(key);continue}const role=property(object,'visualRole')??defaultRole;if(typeof role!=='string'||!asset.allowedRoles.includes(role as VisualAssetRole))throw new Error(`VISUAL_ROLE_NOT_ALLOWED: ${key}.${String(role)}`);if(!scene.textures.exists(key)){missing.add(key);continue}
    const image=scene.add.image(object.x+object.width*asset.defaultOrigin.x+(layer.offsetx??0),object.y+object.height*asset.defaultOrigin.y+(layer.offsety??0),key).setOrigin(asset.defaultOrigin.x,asset.defaultOrigin.y).setDisplaySize(object.width||asset.width,object.height||asset.height).setDepth(numeric(property(object,'depth'),asset.defaultDepth)).setAlpha(numeric(property(object,'alpha'),layer.opacity)).setScrollFactor(numeric(property(object,'scrollFactorX'),layer.parallaxx??1),numeric(property(object,'scrollFactorY'),layer.parallaxy??1));const color=tint(property(object,'tint'));if(color!==undefined)image.setTint(color);const blend=blendMode(property(object,'blendMode'));if(blend!==undefined)image.setBlendMode(blend);if(object.gid!==undefined){image.setFlip((object.gid&0x80000000)!==0,(object.gid&0x40000000)!==0)}objects.push(image);rendered=true;if(role==='background')background++;else if(role==='foreground')foreground++;else if(role.includes('Architecture')||role==='architecture')architecture++;else props++;
   }if(rendered)layers.push(layer.name)
  }
  return{objects,renderedLayerNames:layers,backgroundObjectCount:background,architectureObjectCount:architecture,propObjectCount:props,foregroundObjectCount:foreground,missingAssetKeys:[...missing],destroy(){for(const object of objects)object.destroy();objects.length=0}}
 }
}
function propertyLayer(layer:TiledObjectLayer,name:string):TiledPropertyValue|undefined{return TiledObjectParser.properties(layer.properties??[])[name]}
