import Phaser from 'phaser';
import { corridorVisualV2 } from '../config/environmentVisualsV2';

export interface MinimapActor { x:number; y:number; active?:boolean }
export class MinimapSystem {
  private container?:Phaser.GameObjects.Container; private dots:Phaser.GameObjects.Arc[]=[]; private discovered=new Set<number>();
  constructor(private readonly scene:Phaser.Scene, private readonly players:()=>readonly MinimapActor[], private readonly allies:()=>readonly MinimapActor[], private readonly enemies:()=>readonly MinimapActor[]){}
  create():void{
    const x=764,y=14,g=this.scene.add.graphics().setScrollFactor(0);
    g.fillStyle(0x081116,.94).fillRoundedRect(x,y,182,100,4).lineStyle(1,0x68818c,1).strokeRoundedRect(x,y,182,100,4);
    g.lineStyle(5,0x40545d,.9); corridorVisualV2.rooms.forEach(r=>g.lineBetween(x+8+r.x/34,y+61,x+8+(r.x+r.width)/34,y+61));
    const title=this.scene.add.text(x+8,y+6,'PASILLOS · PB',{fontFamily:'monospace',fontSize:'9px',color:'#d8e3e5'}).setScrollFactor(0);
    const exit=this.scene.add.triangle(x+164,y+61,0,7,7,0,14,7,0xf3c54e,1).setScrollFactor(0);
    this.container=this.scene.add.container(0,0,[g,title,exit]).setDepth(1200).setScrollFactor(0);
    [0x54d399,0xf472b6,0xf87171].forEach(c=>this.dots.push(this.scene.add.circle(0,0,3,c,1).setDepth(1201).setScrollFactor(0)));
  }
  update():void{const originX=772, originY=75, actorSets=[this.players(),this.allies(),this.enemies().filter(e=>this.nearPlayer(e)).slice(0,1)];actorSets.forEach((set,i)=>{const a=set.find(v=>v.active!==false);const dot=this.dots[i];dot.setVisible(Boolean(a));if(a){dot.setPosition(originX+a.x/34,originY+(a.y-724)/18);this.discovered.add(Math.floor(a.x/1700));}});}
  private nearPlayer(e:MinimapActor):boolean{const p=this.players()[0];return Boolean(p)&&Math.abs(e.x-p.x)<650;}
  get discoveredZoneCount():number{return this.discovered.size;}
  destroy():void{this.container?.destroy(true);this.dots.forEach(d=>d.destroy());this.dots=[];this.discovered.clear();}
}
