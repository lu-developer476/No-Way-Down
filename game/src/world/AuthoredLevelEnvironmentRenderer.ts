import Phaser from 'phaser';
import { worldAssetCatalog } from '../config/worldAssetCatalog.ts';
import type { LevelWorldDefinition } from './LevelWorldDefinition.ts';
export class AuthoredLevelEnvironmentRenderer {
 private objects:Phaser.GameObjects.Image[]=[]; private missing=0;
 private readonly scene:Phaser.Scene;private readonly definition:LevelWorldDefinition;constructor(scene:Phaser.Scene,definition:LevelWorldDefinition){this.scene=scene;this.definition=definition;}
 create():void { for(const item of [...this.definition.environmentInstances,...this.definition.foregroundInstances]){if(!this.scene.textures.exists(item.assetKey)){this.missing++;continue;}this.objects.push(this.scene.add.image(item.x,item.y,item.assetKey).setOrigin(item.originX,item.originY).setScale(item.scaleX,item.scaleY).setFlipX(item.flipX).setAlpha(item.alpha).setDepth(item.depth).setScrollFactor(item.scrollFactorX,item.scrollFactorY));}}
 diagnostics(cameraX=0){const sector=this.definition.environmentalSectors.find(value=>cameraX>=value.x&&cameraX<value.x+value.width)??this.definition.environmentalSectors[0];return {loadedAssetKeys:worldAssetCatalog.filter(a=>this.scene.textures.exists(a.key)).map(a=>a.key),environmentObjectCount:this.definition.environmentInstances.length,foregroundObjectCount:this.definition.foregroundInstances.length,architecturePrimitiveCount:0 as const,missingTextureCount:this.missing,activeSectorId:sector.sectorId};}
 destroy():void{this.objects.forEach(value=>value.destroy());this.objects=[];this.missing=0;}
}
