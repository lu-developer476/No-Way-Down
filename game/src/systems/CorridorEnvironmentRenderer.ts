import Phaser from 'phaser';
import { corridorEnvironmentAssets } from '../config/corridorEnvironmentAssets';
import { corridorEnvironmentComposition, type CorridorSector } from '../config/corridorEnvironmentComposition';

export interface CorridorEnvironmentDiagnostics { loadedEnvironmentAssetKeys:string[]; environmentObjectCount:number; architecturePrimitiveCount:0; foregroundObjectCount:number; missingTextureCount:number; activeSector:CorridorSector; }

/** Owns the authored corridor image layers only; it never creates or changes gameplay geometry. */
export class CorridorEnvironmentRenderer {
  private objects: Phaser.GameObjects.Image[] = [];
  private created = false;
  private missingTextureCount = 0;
  constructor(private readonly scene: Phaser.Scene) {}
  create(): void {
    if (this.created) return;
    this.created = true;
    for (const definition of corridorEnvironmentComposition) {
      if (!this.scene.textures.exists(definition.assetKey)) { this.missingTextureCount++; continue; }
      const image = this.scene.add.image(definition.x, definition.y, definition.assetKey)
        .setOrigin(definition.originX, definition.originY).setScale(definition.scaleX, definition.scaleY)
        .setDepth(definition.depth).setScrollFactor(definition.scrollFactorX, definition.scrollFactorY)
        .setFlipX(definition.flipX).setAlpha(definition.alpha);
      this.objects.push(image);
    }
  }
  diagnostics(cameraX = 0): CorridorEnvironmentDiagnostics {
    const sector = Math.min(4, Math.max(0, Math.floor((cameraX + 560) / 1120)));
    return { loadedEnvironmentAssetKeys:corridorEnvironmentAssets.filter(({key})=>this.scene.textures.exists(key)).map(({key})=>key), environmentObjectCount:this.objects.length, architecturePrimitiveCount:0, foregroundObjectCount:corridorEnvironmentComposition.filter(({role})=>role==='foreground').length, missingTextureCount:this.missingTextureCount, activeSector:['service-entry','teller-security','dark-offices','blocked-corridor','exit-stairs'][sector] as CorridorSector };
  }
  destroy(): void { this.objects.forEach((object)=>object.destroy()); this.objects=[]; this.created=false; this.missingTextureCount=0; }
}
