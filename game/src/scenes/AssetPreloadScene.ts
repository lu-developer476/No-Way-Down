import Phaser from 'phaser';
import { visualTheme } from './visualTheme';
import { CampaignFlowDefinition, SceneFlowManager } from './SceneFlowManager';
import { CharacterAnimations } from '../systems/CharacterAnimations';

const PRELOAD_FILES: Array<{ key: string; path: string; type: 'json' | 'image' }> = [
  { key: 'menu_background', path: 'assets/images/NWD-menu.png', type: 'image' },
  { key: 'characters_panel', path: 'assets/images/NWD-characters.png', type: 'image' },
  { key: 'campaign_flow', path: 'assets/campaign/campaign_flow.json', type: 'json' },
  { key: 'campaign_intro_dialogue', path: 'assets/dialogues/campaign_intro_dialogue.json', type: 'json' },
  { key: 'drive_to_santelmo_cinematic', path: 'assets/cinematics/drive_to_santelmo.json', type: 'json' }
];

export class AssetPreloadScene extends Phaser.Scene {
  constructor() {
    super('AssetPreloadScene');
  }

  preload(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, visualTheme.palette.skyTop, 1);
    this.add.text(width / 2, height / 2, 'Cargando campaña...', {
      color: '#cbd5e1',
      fontSize: '28px',
      fontFamily: 'monospace'
    }).setOrigin(0.5);

    const preloadedAssetPaths = new Map(PRELOAD_FILES.map(({ key, path }) => [key, path]));
    const loggedGroups = new Set<string>();

    this.load.on('filecomplete', (key: string, type: string) => {
      const assetPath = preloadedAssetPaths.get(key);
      console.log(`[AssetLoader] ${type}:${key} cargado`);

      if (key === 'campaign_flow' && !loggedGroups.has('campaign_flow')) {
        console.log('[AssetLoader] campaign_flow cargado');
        loggedGroups.add('campaign_flow');
      }

      if (assetPath?.includes('/dialogues/') && !loggedGroups.has('dialogues')) {
        console.log('[AssetLoader] dialogues cargados');
        loggedGroups.add('dialogues');
      }

      if (assetPath?.includes('/cinematics/') && !loggedGroups.has('cinematics')) {
        console.log('[AssetLoader] cinematics cargadas');
        loggedGroups.add('cinematics');
      }

      if (assetPath?.includes('/levels/') && !loggedGroups.has('levels')) {
        console.log('[AssetLoader] levels cargados');
        loggedGroups.add('levels');
      }
    });

    PRELOAD_FILES.forEach(({ key, path, type }) => {
      if (type === 'json') {
        this.load.json(key, path);
      } else {
        this.load.image(key, path);
      }
    });

    this.load.spritesheet('damian', 'assets/characters/damian.png', {
      frameWidth: 64,
      frameHeight: 64
    });

    this.load.spritesheet('nahir', 'assets/characters/nahir.png', {
      frameWidth: 64,
      frameHeight: 64
    });

    this.load.spritesheet('alan', 'assets/characters/alan.png', {
      frameWidth: 64,
      frameHeight: 64
    });

    this.load.spritesheet('giovanna', 'assets/characters/giovanna.png', {
      frameWidth: 64,
      frameHeight: 64
    });

    this.load.spritesheet('hernan', 'assets/characters/hernan.png', {
      frameWidth: 64,
      frameHeight: 64
    });

    this.load.spritesheet('selene', 'assets/characters/selene.png', {
      frameWidth: 64,
      frameHeight: 64
    });

    this.load.spritesheet('celestino', 'assets/characters/celestino.png', {
      frameWidth: 64,
      frameHeight: 64
    });

    this.load.spritesheet('lorena', 'assets/characters/lorena.png', {
      frameWidth: 64,
      frameHeight: 64
    });

    this.load.spritesheet('yamil', 'assets/characters/yamil.png', {
      frameWidth: 64,
      frameHeight: 64
    });
  }

  create(): void {
    const manager = new SceneFlowManager(this);
    if (!manager.validateCampaignFlow()) {
      console.error('campaign_flow.json no pasó la validación');

      this.add.text(
        this.scale.width / 2,
        this.scale.height / 2,
        'Error: campaign_flow.json inválido',
        {
          fontSize: '18px',
          color: '#ff6666'
        }
      ).setOrigin(0.5);

      return;
    }

    const definition = this.cache.json.get('campaign_flow') as CampaignFlowDefinition;

    CharacterAnimations.create(this);

    manager.loadDefinition(definition);
    this.scene.start('MainMenuScene');
  }
}
