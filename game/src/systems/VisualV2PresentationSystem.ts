import Phaser from 'phaser';
import { visualV2Style } from '../config/visualStyle';

/** Corridor-only composition and contact-shadow owner; gameplay geometry remains untouched. */
export class VisualV2PresentationSystem {
  private objects:Phaser.GameObjects.GameObject[]=[]; private shadows=new Map<Phaser.GameObjects.Components.Transform,Phaser.GameObjects.Ellipse>();
  constructor(private scene:Phaser.Scene,private levelWidth:number,private floorTop:number){}
  create():void{
    // ten explicit depth bands, assembled from repeatable architectural modules
    for(let x=0;x<this.levelWidth;x+=480){
      this.keep(this.scene.add.rectangle(x+240,360,480,540,x%960?0x243139:0x1d2a32,1).setDepth(.2).setScrollFactor(.18,1));
      this.keep(this.scene.add.rectangle(x+240,315,438,350,0x33434a,.78).setStrokeStyle(5,0x11191e).setDepth(.9));
      for(let wx=x+58;wx<x+430;wx+=122){this.keep(this.scene.add.rectangle(wx,300,78,180,0x10232d,.88).setStrokeStyle(6,0x52636a).setDepth(1.1));this.keep(this.scene.add.rectangle(wx,300,4,180,0x111a20,.7).setDepth(1.2));}
      this.keep(this.scene.add.rectangle(x+130,590,82,170,0x29343a,1).setStrokeStyle(5,0x11181c).setDepth(2));
      this.keep(this.scene.add.text(x+95,515,x%960?'SERVICIO':'SALIDA  →',{fontFamily:'monospace',fontSize:'15px',color:x%960?'#a8b6b8':'#f4c955',backgroundColor:'#172126'}).setDepth(2.2));
      this.keep(this.scene.add.rectangle(x+350,this.floorTop-30,130,36,0x3d4748,1).setStrokeStyle(4,0x171d20).setDepth(5.5));
      this.keep(this.scene.add.ellipse(x+350,this.floorTop-8,144,18,0x05090b,.36).setDepth(5.4));
    }
    const g=this.scene.add.graphics().setDepth(2.4);g.lineStyle(7,0x1a2226,1);g.lineBetween(0,92,this.levelWidth,92);g.lineStyle(2,0x59666a,.7);for(let x=90;x<this.levelWidth;x+=310)g.lineBetween(x,92,x+35,430);this.keep(g);
    // Wet floor reflections and restrained foreground framing.
    for(let x=220;x<this.levelWidth;x+=520)this.keep(this.scene.add.ellipse(x,this.floorTop+24,250,22,0x76a6ae,.07).setDepth(4));
    for(let x=700;x<this.levelWidth;x+=1450)this.keep(this.scene.add.rectangle(x,this.floorTop-90,24,260,0x071014,.55).setDepth(850).setScrollFactor(1.08,1));
  }
  track(actor:Phaser.GameObjects.Components.Transform):void{if(this.shadows.has(actor))return;const s=this.scene.add.ellipse(actor.x,actor.y,42,12,0x071012,.38).setDepth(10);this.shadows.set(actor,s);}
  update():void{for(const [a,s]of this.shadows){const active=(a as unknown as {active?:boolean}).active!==false;s.setVisible(active);if(active)s.setPosition(Math.round(a.x),Math.round(a.y-2)).setDepth(a.y-.5);}}
  get shadowCount():number{return this.shadows.size;}
  destroy():void{this.objects.forEach(o=>o.destroy());this.objects=[];this.shadows.forEach(s=>s.destroy());this.shadows.clear();}
  private keep<T extends Phaser.GameObjects.GameObject>(o:T):T{this.objects.push(o);return o;}
}
