import Phaser from 'phaser';import type{CanonicalManifest}from'../campaign/types';import{RegistryKeys}from'../config/RegistryKeys';

export class AssetPreloadScene extends Phaser.Scene{constructor(){super('AssetPreloadScene')}preload(){
this.load.image('nwd-menu','assets/images/NWD-menu.png');
this.load.image('nwd-characters','assets/images/NWD-characters.png');
this.load.json('canonical-manifest','assets/campaign/canonical_campaign_manifest.json');
this.load.json('story-bible','assets/campaign/story_bible.json')
}
create(){
const manifest=this.cache.json.get('canonical-manifest') as CanonicalManifest;if(manifest.flowId!=='main_campaign'||manifest.canonicalNodeCount!==35||manifest.nodes.length!==35)throw new Error('Canonical campaign invariant failed');this.registry.set(RegistryKeys.manifest,manifest);this.registry.set(RegistryKeys.cursor,0);this.scene.start('MainMenuScene')}}
