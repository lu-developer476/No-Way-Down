import Phaser from 'phaser';
import { controlManager } from '../input/ControlManager';
import { FlowDebugOverlay } from './flowDebug';
import { CampaignFlowNode, SceneFlowManager } from './SceneFlowManager';
import { addRetroScreenOverlay, applyRetroRenderer, RETRO_PIXEL_FONT } from './retroPixelArt';
import { getAudioManager } from '../audio/AudioManager';
import { commitCanonicalNode } from '../campaign/canonicalPartyProgression';
import type { CampaignStateData } from '../systems/core/CampaignState';
import type { PartyMember } from '../systems/core/PartyStateSystem';
import { persistCampaignCompleted } from './sceneShared';

interface CinematicBeat {
  beat: string;
}

interface CinematicSceneData {
  flowNode?: CampaignFlowNode;
}

export class CinematicScene extends Phaser.Scene {
  private enterKey?: Phaser.Input.Keyboard.Key;
  private advanceKeys: Phaser.Input.Keyboard.Key[] = [];

  private hasStarted = false;

  private isTransitioning = false;

  private flowManager?: SceneFlowManager;

  private flowDebug?: FlowDebugOverlay;

  constructor() {
    super('CinematicScene');
  }

  create(data: CinematicSceneData = {}): void {
    this.hasStarted = false;
    this.isTransitioning = false;
    const flowNode = data.flowNode ?? this.registry.get('activeCampaignNode') as CampaignFlowNode | undefined;
    if (!flowNode) {
      this.showDevelopmentError(undefined, 'No se recibió el nodo cinematográfico activo.');
      return;
    }

    this.flowManager = new SceneFlowManager(this);
    if (!this.flowManager.confirmPendingTransition(flowNode)) {
      this.showDevelopmentError(flowNode.cinematicPath, 'La transición pendiente no coincide con esta cinemática.');
      return;
    }

    this.commitNarrativeState(flowNode.id);

    applyRetroRenderer(this);
    const cinematicPath = flowNode.cinematicPath;
    this.renderCinematic(cinematicPath);

    if (flowNode.id === 'campaign-end') {
      persistCampaignCompleted();
      this.registry.set('campaignCompleted', true);
    }

    this.flowDebug = new FlowDebugOverlay(this, this.flowManager, () => ({
      flowNode: this.registry.get('activeCampaignNode') as CampaignFlowNode | undefined,
      enterDown: this.enterKey?.isDown ?? false,
      hasStarted: this.hasStarted,
      isTransitioning: this.isTransitioning
    }));
    this.flowDebug.create();

    if (this.input.keyboard) {
      this.enterKey = this.input.keyboard.addKey(controlManager.getKeyCode('next_level'));
      this.advanceKeys = [...new Set([
        this.enterKey,
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
        this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X)
      ])];
    } else {
      console.error('[CinematicScene] Keyboard input no está disponible.');
    }

    this.input.once('pointerdown', () => {
      this.advanceToNextNode('click');
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      getAudioManager(this).stopCinematicMusic();
      this.registry.set('dialogueState', null);
      this.registry.set('interactionHint', '');
      this.registry.set('transitionView', { visible: false, message: '', tone: 'normal' });
      this.advanceKeys.forEach((key) => this.input.keyboard?.removeKey(key));
      this.advanceKeys = [];
    });
  }

  private commitNarrativeState(nodeId: string): void {
    const campaign = this.registry.get('campaignState') as CampaignStateData | undefined;
    if (!campaign) return;
    const result = commitCanonicalNode(nodeId, (this.registry.get('partyState') as PartyMember[] | undefined) ?? [], campaign);
    this.registry.set('campaignState', result.campaign);
    this.registry.set('partyState', result.party);
    // Cinematics do not render combat HUD; the next level rebuilds it from this party snapshot.
    this.registry.set('partyHud', []);
    const saved = this.registry.get('campaignSnapshot') as Record<string, unknown> | undefined;
    if (saved) this.registry.set('campaignSnapshot', {
      ...saved,
      party: {
        active: result.party.filter((member) => member.status === 'active').map((member) => member.name),
        dead: result.party.filter((member) => member.status === 'dead').map((member) => member.name),
        rescued: result.party.filter((member) => result.campaign.rescuedCharacters.includes(member.id)).map((member) => member.name),
        infected: result.party.filter((member) => member.status === 'infected').map((member) => member.name)
      },
      narrative: {
        flags: result.campaign.narrativeProgress,
        irreversible_events: result.campaign.irreversibleEvents,
        seen_cinematics: result.campaign.seenCinematics
      }
    });
  }

  private renderCinematic(cinematicPath?: string): void {
    const { width, height } = this.scale;
    const cacheKey = this.toFlowAssetCacheKey(cinematicPath);
    const renderFromCache = () => {
      const cinematic = (cacheKey ? this.cache.json.get(cacheKey) : undefined) as { beats: CinematicBeat[] } | undefined;
      if (!cinematic?.beats) {
        this.showDevelopmentError(cinematicPath, 'El contenido de la cinemática es inválido.');
        return;
      }
      const beats = cinematic.beats;

      this.add.rectangle(width / 2, height / 2, width, height, 0x020617, 1);
      this.add.rectangle(width / 2, 80, width - 96, 82, 0x100913, 0.92).setStrokeStyle(3, 0xf6d365, 1);
      this.add.text(width / 2, 64, 'CINEMÁTICA // PIXEL CUTSCENE', { color: '#f8fafc', fontFamily: RETRO_PIXEL_FONT, fontSize: '26px', fontStyle: 'bold' }).setOrigin(0.5);
      this.add.text(width / 2, height / 2, beats.map((b) => `• ${b.beat}`).join('\n'), {
        color: '#cbd5e1',
        fontFamily: RETRO_PIXEL_FONT,
        fontSize: '18px',
        align: 'center',
        wordWrap: { width: width - 120 }
      }).setOrigin(0.5);
      this.add.text(width / 2, height - 36, 'ENTER o clic para continuar', { color: '#f6d365', fontFamily: RETRO_PIXEL_FONT, fontSize: '14px' }).setOrigin(0.5);
      addRetroScreenOverlay(this, 3);
    };

    if (!cinematicPath || !cacheKey) {
      this.showDevelopmentError(cinematicPath, 'El nodo canónico no define cinematicPath.');
      return;
    }

    if (this.cache.json.exists(cacheKey)) {
      renderFromCache();
      return;
    }

    const assetUrl = cinematicPath.startsWith('/') ? cinematicPath : `/${cinematicPath}`;
    this.load.json(cacheKey, assetUrl);
    this.load.once(`filecomplete-json-${cacheKey}`, renderFromCache);
    this.load.once('loaderror', () => {
      this.showDevelopmentError(cinematicPath, 'No se pudo cargar el asset canónico.');
    });
    this.load.start();
  }

  private showDevelopmentError(cinematicPath: string | undefined, reason: string): void {
    this.hasStarted = true;
    console.error('[CinematicScene] ERROR DE DESARROLLO', { cinematicPath, reason });
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, height / 2, width, height, 0x09070b, 1);
    this.add.text(width / 2, height / 2, [
      'ERROR EXPLÍCITO DE DESARROLLO', '', `Asset: ${cinematicPath ?? 'sin ruta'}`, reason,
      '', 'La campaña fue detenida; no existe fallback.'
    ].join('\n'), { color: '#f87171', fontFamily: 'monospace', fontSize: '18px', align: 'center' }).setOrigin(0.5);
  }

  private toFlowAssetCacheKey(path?: string): string | undefined {
    if (!path) {
      return undefined;
    }

    return `campaign_asset::${path}`;
  }

  update(): void {
    this.flowDebug?.update();

    if (this.advanceKeys.length === 0 || this.hasStarted) {
      return;
    }

    if (this.advanceKeys.some((key) => Phaser.Input.Keyboard.JustDown(key))) {
      this.advanceToNextNode('enter');
    }
  }

  private advanceToNextNode(source: 'enter' | 'click'): void {
    if (this.hasStarted) {
      return;
    }

    this.hasStarted = true;
    const manager = this.flowManager ?? new SceneFlowManager(this);

    const currentNode = this.registry.get('activeCampaignNode') as CampaignFlowNode | undefined;
    const currentNodeId = currentNode?.id ?? (this.registry.get('flowNodeId') as string | undefined);
    if (currentNodeId === 'campaign-end') {
      this.hasStarted = true;
      getAudioManager(this).stopCinematicMusic();
      this.scene.stop('UIScene');
      this.scene.start('MainMenuScene');
      return;
    }
    const next = manager.advanceFromNodeId(currentNodeId);

    if (!next) {
      console.error('[CinematicScene] Error: no existe nodo siguiente para avanzar desde CinematicScene.');
      return;
    }

    console.info('[CinematicScene] Avance de flujo validado.', {
      currentNodeId,
      nextNodeId: next.id
    });

    this.isTransitioning = true;
    void source;
    manager.transitionToNode(next);
  }
}
