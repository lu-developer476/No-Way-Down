import Phaser from 'phaser';
/** Contact-shadow owner. Authored architecture belongs to CorridorEnvironmentRenderer. */
export class VisualV2PresentationSystem {
  private objects:Phaser.GameObjects.GameObject[]=[]; private shadows=new Map<Phaser.GameObjects.Components.Transform,Phaser.GameObjects.Ellipse>();
  constructor(private scene:Phaser.Scene,private levelWidth:number,private floorTop:number){}
  create():void{
    // Environmental objects are intentionally absent here.
  }
  track(actor:Phaser.GameObjects.Components.Transform):void{if(this.shadows.has(actor))return;const s=this.scene.add.ellipse(actor.x,actor.y,42,12,0x071012,.38).setDepth(10);this.shadows.set(actor,s);}
  update():void{for(const [a,s]of this.shadows){const active=(a as unknown as {active?:boolean}).active!==false;s.setVisible(active);if(active)s.setPosition(Math.round(a.x),Math.round(a.y-2)).setDepth(a.y-.5);}}
  get shadowCount():number{return this.shadows.size;}
  destroy():void{this.objects.forEach(o=>o.destroy());this.objects=[];this.shadows.forEach(s=>s.destroy());this.shadows.clear();}
  private keep<T extends Phaser.GameObjects.GameObject>(o:T):T{this.objects.push(o);return o;}
}
