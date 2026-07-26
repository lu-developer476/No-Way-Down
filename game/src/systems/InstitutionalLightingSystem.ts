import Phaser from 'phaser';
import { visualV2Style } from '../config/visualStyle';

type LightRecord = { object: Phaser.GameObjects.Shape; expiresAt?: number; flicker?: { speed:number; phase:number } };

/** Low-cost authored light volumes. Objects are allocated on create, never per frame. */
export class InstitutionalLightingSystem {
  private readonly lights: LightRecord[] = [];
  private ambient?: Phaser.GameObjects.Rectangle;
  constructor(private readonly scene: Phaser.Scene) {}

  create(levelWidth:number, levelHeight:number): void {
    this.ambient = this.scene.add.rectangle(levelWidth/2, levelHeight/2, levelWidth, levelHeight, visualV2Style.palette.ambient, .16).setDepth(900).setBlendMode(Phaser.BlendModes.MULTIPLY);
    for (let x=440, i=0; x<levelWidth; x+=720, i++) {
      const glow=this.scene.add.ellipse(x,585,420,260,i%3===1?visualV2Style.palette.emergency:0x8cc9d4,i%3===1?.09:.075).setDepth(901).setBlendMode(Phaser.BlendModes.ADD);
      this.lights.push({object:glow,flicker:i%3===1?{speed:.006,phase:i}:undefined});
    }
  }
  flash(x:number,y:number,reduced=false): void {
    if (reduced || this.lights.filter(l=>l.expiresAt).length>=visualV2Style.budgets.temporaryLights) return;
    const object=this.scene.add.circle(x,y,76,0xffb13b,.28).setDepth(902).setBlendMode(Phaser.BlendModes.ADD);
    this.lights.push({object,expiresAt:this.scene.time.now+70});
  }
  update(now:number): void {
    for(let i=this.lights.length-1;i>=0;i--){ const l=this.lights[i]; if(l.expiresAt&&now>=l.expiresAt){l.object.destroy();this.lights.splice(i,1);continue;} if(l.flicker)l.object.setAlpha(.055+Math.abs(Math.sin(now*l.flicker.speed+l.flicker.phase))*.06); }
  }
  get count():number{return this.lights.length;}
  destroy():void{this.ambient?.destroy();this.ambient=undefined;this.lights.forEach(l=>l.object.destroy());this.lights.length=0;}
}
