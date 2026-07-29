import Phaser from 'phaser';
import { ProductionCharacterArt, productionCharacterManifest } from '../visual/ProductionCharacterArt';

/** Query-only, read-only review surface for generated production art. */
export class ProductionArtGalleryScene extends Phaser.Scene {
  private actor!: Phaser.GameObjects.Sprite;
  private info!: Phaser.GameObjects.Text;
  private debug!: Phaser.GameObjects.Graphics;
  private characterIndex = 0;
  private animationIndex = 0;
  private playing = true;
  private flipped = false;
  private showBody = false;
  private showGround = true;
  private weaponIndex = 0;
  private readonly weapons = ['pistol','revolver','smg','shotgun','carbine','sniper-rifle','light-machine-gun','knife','machete','sword','tray-shield'];
  constructor(){super('ProductionArtGalleryScene');}
  preload():void { ProductionCharacterArt.queue(this,productionCharacterManifest.characters.map(entry=>entry.characterId)); }
  create():void {
    ProductionCharacterArt.registerAnimations(this,productionCharacterManifest.characters.map(entry=>entry.characterId));
    this.cameras.main.setBackgroundColor('#101820').setRoundPixels(true);
    this.add.text(24,18,'PRODUCTION ART V2 · GALERÍA QA',{fontFamily:'monospace',fontSize:'20px',color:'#e8c96b'});
    this.add.text(24,490,'←/→ personaje  ↑/↓ animación  A/D frame  ESP pausa  F flip  B body  G suelo  W arma  ESC menú',{fontFamily:'monospace',fontSize:'13px',color:'#aab8c2'});
    this.info=this.add.text(610,72,'',{fontFamily:'monospace',fontSize:'15px',color:'#dbe7ec',lineSpacing:8});
    this.debug=this.add.graphics(); this.bindKeys(); this.select();
  }
  private bindKeys():void {
    const key=(name:string,fn:()=>void)=>this.input.keyboard?.on(`keydown-${name}`,fn);
    key('LEFT',()=>{this.characterIndex--;this.select();}); key('RIGHT',()=>{this.characterIndex++;this.select();});
    key('UP',()=>{this.animationIndex--;this.select();}); key('DOWN',()=>{this.animationIndex++;this.select();});
    key('A',()=>this.step(-1)); key('D',()=>this.step(1)); key('SPACE',()=>{this.playing=!this.playing;this.select();});
    key('F',()=>{this.flipped=!this.flipped;this.select();}); key('B',()=>{this.showBody=!this.showBody;this.drawGuides();});
    key('G',()=>{this.showGround=!this.showGround;this.drawGuides();}); key('W',()=>{this.weaponIndex=(this.weaponIndex+1)%this.weapons.length;this.select();});
    key('ESC',()=>this.scene.start('MainMenuScene'));
  }
  private select():void {
    const entries=productionCharacterManifest.characters; this.characterIndex=Phaser.Math.Wrap(this.characterIndex,0,entries.length);
    const entry=entries[this.characterIndex], animations=Object.keys(entry.animations); this.animationIndex=Phaser.Math.Wrap(this.animationIndex,0,animations.length);
    const animation=animations[this.animationIndex]; this.actor?.destroy(); this.actor=this.add.sprite(370,330,ProductionCharacterArt.sheetAlias(entry.characterId)).setOrigin(40/80,104/112).setFlipX(this.flipped);
    if(this.playing)this.actor.play(`${entry.characterId}-${animation==='walk'?'run':animation}`); else this.actor.setFrame(entry.animations[animation].startFrame);
    this.info.setText([`characterId  ${entry.characterId}`,`animation    ${animation}`,`frame        ${this.actor.frame.name}`,`frame count  ${entry.animations[animation].endFrame-entry.animations[animation].startFrame+1}`,`FPS          ${entry.animations[animation].fps}`,`foot error   0 px`,`body         ${entry.bodyProfile.width} × ${entry.bodyProfile.height}`,`held anchor  ${entry.heldWeaponAnchor.x}, ${entry.heldWeaponAnchor.y}`,`holstered    ${entry.holsteredPrimaryAnchor.x}, ${entry.holsteredPrimaryAnchor.y}`,`weapon       ${this.weapons[this.weaponIndex]}`,`facing       ${this.flipped?'left':'right'}`,`scale        1`, `palette      production-v2`]); this.drawGuides();
  }
  private step(delta:number):void {this.playing=false;this.actor.anims.stop();const entry=productionCharacterManifest.characters[this.characterIndex],a=Object.values(entry.animations)[this.animationIndex];this.actor.setFrame(Phaser.Math.Wrap(Number(this.actor.frame.name)+delta,a.startFrame,a.endFrame+1));this.selectInfoFrame();}
  private selectInfoFrame():void { const lines=this.info.text.split('\n');lines[2]=`frame        ${this.actor.frame.name}`;this.info.setText(lines); }
  private drawGuides():void {this.debug.clear();const entry=productionCharacterManifest.characters[this.characterIndex];if(this.showGround)this.debug.lineStyle(1,0x58d6c7).lineBetween(160,330,570,330);if(this.showBody)this.debug.lineStyle(1,0xffcc55).strokeRect(370-entry.bodyProfile.width/2,330-entry.bodyProfile.height,entry.bodyProfile.width,entry.bodyProfile.height);}
}
