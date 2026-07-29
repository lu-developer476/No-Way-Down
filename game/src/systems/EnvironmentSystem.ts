import Phaser from 'phaser';
import { getLevelBackdropProfile, type LevelBackdropProfile } from '../config/LevelBackdropProfiles';
import { Level10ParkingExplorationSystem } from './Level10ParkingExplorationSystem';
import level4ReverseRouteJson from '../../public/assets/levels/level4_reverse_route.json';
import { ReverseRouteConfig, ReverseRouteSystem } from './ReverseRouteSystem';

export const BANK_INTERIOR_ATLAS_PATH = 'assets/production-art/environments/bank-interior-kit.png';

/** Sole production authority for photographic level backdrops and environment runtime systems. */
export class EnvironmentSystem {
  private readonly instantiated: unknown[] = [];
  private backdrop?: Phaser.GameObjects.Image;
  private backdropKey?: string;
  constructor(private readonly scene: Phaser.Scene) { this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN,()=>this.destroy()); }
  instantiate(systemNames: string[]): void {
    const runtimeLevelId=String(this.scene.registry.get('activeRuntimeLevelId')??'');
    const profile=getLevelBackdropProfile(runtimeLevelId);
    if(profile)this.loadBackdrop(profile); else this.scene.registry.set('visualFallbackUsed',true);
    const constructors: Record<string, () => unknown> = {
      Level10ParkingExplorationSystem: () => new Level10ParkingExplorationSystem({levelId:'parking-runtime',vehicles:[],resources:[]}),
      ReverseRouteSystem: () => { const system=ReverseRouteSystem.fromJson(level4ReverseRouteJson as ReverseRouteConfig);this.scene.registry.set('level4CanonicalReverseRoute',system.getSnapshot());return system; }
    };
    systemNames.forEach(name=>{const create=constructors[name];if(!create){this.scene.registry.set(`environmentSystemMissing:${name}`,true);return;}try{this.instantiated.push(create())}catch{this.scene.registry.set(`environmentSystemInvalidConfig:${name}`,true)}});
  }
  private loadBackdrop(profile:LevelBackdropProfile):void{
    const key=`level-backdrop:${profile.id}`;this.backdropKey=key;
    const create=()=>{if(!this.scene.sys.isActive()||this.backdrop)return;const texture=this.scene.textures.get(key).getSourceImage() as HTMLImageElement;const c=profile.crop;const crop={x:texture.width*c.x,y:texture.height*c.y,width:texture.width*c.width,height:texture.height*c.height};const fit=profile.fitMode==='cover'?Math.max(this.scene.scale.width/crop.width,this.scene.scale.height/crop.height):Math.min(this.scene.scale.width/crop.width,this.scene.scale.height/crop.height);this.backdrop=this.scene.add.image(this.scene.scale.width/2,this.scene.scale.height/2,key).setOrigin(profile.origin.x,profile.origin.y).setCrop(crop.x,crop.y,crop.width,crop.height).setScale(fit*profile.scale).setScrollFactor(profile.scrollFactor.x,profile.scrollFactor.y).setTint(profile.tint).setAlpha(profile.alpha).setDepth(-100);this.scene.registry.set('backdropProfileId',profile.id);this.scene.registry.set('backgroundAssetPath',profile.backgroundAssetPath);this.scene.registry.set('environmentRenderer','EnvironmentSystem');this.scene.registry.set('visualFallbackUsed',false)};
    if(this.scene.textures.exists(key)){create();return}this.scene.load.once(`filecomplete-image-${key}`,create);this.scene.load.once('loaderror',(file:Phaser.Loader.File)=>{if(file.key===key){this.scene.registry.set('visualFallbackUsed',true);this.scene.registry.set('backdropLoadError',profile.backgroundAssetPath)}});this.scene.load.image(key,profile.backgroundAssetPath);this.scene.load.start();
  }
  destroy():void{this.backdrop?.destroy();this.backdrop=undefined;if(this.backdropKey&&this.scene.textures.exists(this.backdropKey))this.scene.textures.remove(this.backdropKey);this.backdropKey=undefined;}
}
