import type Phaser from 'phaser';
import type { ProductionCharacterEntry } from './ProductionCharacterArt';

export type WalkableSurface={left:number;right:number;top:number};
export type GroundAnchorSnapshot={foot:{x:number;y:number};bodyBottom:number;shadow:{x:number;y:number};nameplate:{x:number;y:number};groundError:number;wholePixels:boolean};
export class GroundAnchorSystem {
  static readonly ORIGIN={x:40,y:104};
  static footPoint(actor:{x:number;y:number}){return{x:Math.round(actor.x),y:Math.round(actor.y)};}
  static apply(sprite:Phaser.Physics.Arcade.Sprite,entry:ProductionCharacterEntry):void {
    sprite.setScale(1).setDisplayOrigin(this.ORIGIN.x,this.ORIGIN.y).setBodySize(entry.bodyProfile.width,entry.bodyProfile.height).setOffset(entry.bodyProfile.offsetX,entry.bodyProfile.offsetY);
    sprite.setPosition(Math.round(sprite.x),Math.round(sprite.y));
  }
  static nearestSurface(x:number,y:number,surfaces:readonly WalkableSurface[]):WalkableSurface|undefined {
    return surfaces.filter(s=>x>=s.left&&x<=s.right).sort((a,b)=>Math.abs(a.top-y)-Math.abs(b.top-y))[0];
  }
  static resolveRecovery(target:{x:number;y:number},surfaces:readonly WalkableSurface[],bounds:{left:number;right:number},occupied:readonly number[]=[]):{x:number;y:number} {
    const x=Math.max(bounds.left+27,Math.min(bounds.right-27,Math.round(target.x)));const surface=this.nearestSurface(x,target.y,surfaces);
    if(!surface)throw new Error('[GroundAnchorSystem] No walkable recovery surface below ally.');
    let resolvedX=x;for(let step=0;occupied.some(other=>Math.abs(other-resolvedX)<54)&&step<8;step++)resolvedX=Math.max(surface.left+27,Math.min(surface.right-27,x+(step%2?1:-1)*54*Math.ceil((step+1)/2)));
    return{x:resolvedX,y:Math.round(surface.top)};
  }
  static spawnFormation(anchor:{x:number;y:number},count:number,bounds:{left:number;right:number},spacing=54):Array<{x:number;y:number}>{
    return Array.from({length:count},(_,i)=>i===0?{x:Math.round(anchor.x),y:Math.round(anchor.y)}:{x:Math.max(bounds.left,Math.min(bounds.right,Math.round(anchor.x+(i%2? -1:1)*Math.ceil(i/2)*spacing))),y:Math.round(anchor.y)});
  }
  static snapshot(actor:{x:number;y:number},entry:ProductionCharacterEntry,surfaceTop:number):GroundAnchorSnapshot {const foot=this.footPoint(actor);return{foot,bodyBottom:foot.y,shadow:{x:foot.x,y:foot.y+entry.shadowAnchor.y},nameplate:{x:foot.x+entry.nameplateAnchor.x,y:foot.y+entry.nameplateAnchor.y},groundError:Math.abs(foot.y-surfaceTop),wholePixels:Number.isInteger(actor.x)&&Number.isInteger(actor.y)};}
}
