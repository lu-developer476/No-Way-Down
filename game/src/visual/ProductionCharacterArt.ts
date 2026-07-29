import Phaser from 'phaser';
import manifestJson from '../../public/assets/production-art/characters/character_art_manifest.json';

export type ProductionAnimation = { row:number; startFrame:number; endFrame:number; fps:number; repeat:number };
export type ProductionCharacterEntry = {
  characterId:string; sheetPath:string; portraitPath?:string; frameWidth:number; frameHeight:number; footLine:number;
  animations:Record<string,ProductionAnimation>; bodyProfile:{width:number;height:number;offsetX:number;offsetY:number};
  heldWeaponAnchor:{x:number;y:number}; holsteredPrimaryAnchor:{x:number;y:number}; holsteredSecondaryAnchor:{x:number;y:number};
  nameplateAnchor:{x:number;y:number}; shadowAnchor:{x:number;y:number};
};
const manifest = manifestJson as unknown as {visualOrigin:{x:number;y:number};characters:ProductionCharacterEntry[]};
const entries = new Map(manifest.characters.map((entry)=>[entry.characterId,entry]));

export class ProductionCharacterArt {
  private static consumers=new Map<string,number>();
  private static guardedScenes=new WeakSet<Phaser.Scene>();
  static get visualOrigin(){return manifest.visualOrigin;}
  static resolve(characterId:string):ProductionCharacterEntry {
    const entry=entries.get(characterId);
    if(!entry) throw new Error(`[ProductionCharacterArt] Unknown characterId "${characterId}".`);
    return entry;
  }
  static textureKey(characterId:string):string{return `production-${this.resolve(characterId).characterId}`;}
  static sheetAlias(characterId:string):string{return `${characterId}-sheet`;}
  static queue(scene:Phaser.Scene,characterIds:readonly string[]):void {
    if(!this.guardedScenes.has(scene)){
      this.guardedScenes.add(scene);
      scene.load.on('loaderror',(file:Phaser.Loader.File)=>{
        const path=String(file.url);
        if(path.includes('assets/production-art/')) throw new Error(`[ProductionCharacterArt] Fatal: missing generated sprite "${path}". Run npm run generate:runtime-art.`);
      });
    }
    for(const requested of new Set(characterIds)){
      const entry=this.resolve(requested); const key=this.textureKey(entry.characterId);
      if(!scene.textures.exists(key)) scene.load.spritesheet(key,entry.sheetPath,{frameWidth:entry.frameWidth,frameHeight:entry.frameHeight});
      const alias=this.sheetAlias(requested);
      if(!scene.textures.exists(alias)) scene.load.spritesheet(alias,entry.sheetPath,{frameWidth:entry.frameWidth,frameHeight:entry.frameHeight});
      if(entry.portraitPath&&!scene.textures.exists(`portrait-${entry.characterId}`))scene.load.image(`portrait-${entry.characterId}`,entry.portraitPath);
      this.consumers.set(entry.characterId,(this.consumers.get(entry.characterId)??0)+1);
    }
  }
  static registerAnimations(scene:Phaser.Scene,characterIds:readonly string[]):void {
    for(const requested of new Set(characterIds)){
      const entry=this.resolve(requested), texture=this.sheetAlias(requested);
      for(const [state,definition] of Object.entries(entry.animations)){
        const runtimeState=state==='walk'?'run':state; const key=`${requested}-${runtimeState}`;
        const expected=definition.endFrame-definition.startFrame+1;
        if(expected<2)throw new Error(`[ProductionCharacterArt] ${key} must contain multiple frames.`);
        if(!scene.anims.exists(key))scene.anims.create({key,frames:scene.anims.generateFrameNumbers(texture,{start:definition.startFrame,end:definition.endFrame}),frameRate:definition.fps,repeat:definition.repeat});
      }
    }
  }
  static release(scene:Phaser.Scene,characterIds:readonly string[]):void {
    for(const requested of new Set(characterIds)){const entry=this.resolve(requested);const count=(this.consumers.get(entry.characterId)??1)-1;if(count<=0){this.consumers.delete(entry.characterId);for(const key of [this.textureKey(entry.characterId),this.sheetAlias(requested)])if(scene.textures.exists(key))scene.textures.remove(key);}else this.consumers.set(entry.characterId,count);}
  }
}
export const productionCharacterManifest=manifest;
