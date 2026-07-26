import Phaser from 'phaser';
import { visualTheme } from './visualTheme';
import { SceneFlowManager } from './SceneFlowManager';
import { definitionFromManifest, type CanonicalManifest } from '../campaign/campaignCore';

const PRELOAD_FILES: Array<{ key: string; path: string; type: 'json' | 'image' }> = [
  { key: 'menu_background', path: 'assets/images/NWD-menu.png', type: 'image' },
  { key: 'characters_panel', path: 'assets/images/NWD-characters.png', type: 'image' },
  { key: 'story_bible', path: 'assets/campaign/story_bible.json', type: 'json' },
  { key: 'canonical_campaign_manifest', path: 'assets/campaign/canonical_campaign_manifest.json', type: 'json' },
  { key: 'campaign_implementation_registry', path: 'assets/campaign/campaign_implementation_registry.json', type: 'json' },
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

      if (key === 'story_bible' && !loggedGroups.has('story_bible')) {
        console.log('[AssetLoader] story_bible cargado');
        loggedGroups.add('story_bible');
      }

      if (
        key === 'canonical_campaign_manifest'
        && !loggedGroups.has('canonical_campaign_manifest')
      ) {
        console.log('[AssetLoader] canonical_campaign_manifest cargado');
        loggedGroups.add('canonical_campaign_manifest');
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
  }

  create(): void {
    const canonicalManifest = this.cache.json.get('canonical_campaign_manifest');

    if (!this.validateCanonicalCampaignManifest(canonicalManifest)) {
      console.error('[Campaign] canonical_campaign_manifest.json inválido.');
      this.add.rectangle(
        this.scale.width / 2,
        this.scale.height / 2,
        this.scale.width,
        this.scale.height,
        0x09070b,
        1
      );
      this.add.text(
        this.scale.width / 2,
        this.scale.height / 2,
        [
          'ERROR DE CAMPAÑA',
          '',
          'El manifiesto narrativo canónico es inválido.',
          'Revisá la consola del navegador.'
        ].join('\n'),
        {
          fontSize: '18px',
          color: '#f87171',
          align: 'center',
          fontFamily: 'monospace'
        }
      ).setOrigin(0.5);
      return;
    }

    const manager = new SceneFlowManager(this);
    if (!manager.validateCampaignFlow()) {
      console.error('canonical_campaign_manifest.json no pasó la validación');

      this.add.text(
        this.scale.width / 2,
        this.scale.height / 2,
        'Error: manifiesto canónico inválido',
        {
          fontSize: '18px',
          color: '#ff6666'
        }
      ).setOrigin(0.5);

      return;
    }

    const definition = definitionFromManifest(canonicalManifest as CanonicalManifest);
    this.registry.set('canonicalCampaignManifest', canonicalManifest);
    this.registry.set('storyBible', this.cache.json.get('story_bible') ?? null);

    manager.loadDefinition(definition);
    this.scene.start('MainMenuScene');
  }

  private validateCanonicalCampaignManifest(value: unknown): boolean {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return false;
    }

    const manifest = value as Record<string, unknown>;
    if (
      manifest.manifestVersion !== 1
      || manifest.flowId !== 'main_campaign'
      || manifest.canonicalNodeCount !== 35
      || !Array.isArray(manifest.nodes)
      || manifest.nodes.length !== 35
    ) {
      return false;
    }

    const ids = manifest.nodes.map((node) => (
      node && typeof node === 'object'
        ? (node as Record<string, unknown>).id
        : undefined
    ));
    if (ids.some((id) => typeof id !== 'string') || new Set(ids).size !== ids.length) {
      return false;
    }

    return [
      'lvl03-cin01-llamado-lorena-rescate',
      'lvl06-cin02-muerte-lorena-y-guardia-en-salida-e',
      'lvl08-cin01-damian-infectado-y-suicidio',
      'lvl08-cin02-sacrificio-hernan-yamil',
      'lvl09-cin02-traicion-de-selene-y-huida',
      'lvl10-cin02-cierre-duo-final-en-san-telmo'
    ].every((id) => ids.includes(id));
  }
}
