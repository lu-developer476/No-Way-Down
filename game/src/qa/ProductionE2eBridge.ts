import type Phaser from 'phaser';
import { SceneFlowManager, type CampaignFlowDefinition, type CampaignFlowNode } from '../scenes/SceneFlowManager';
import { clearRunForNewGame, CAMPAIGN_COMPLETION_STORAGE_KEY, LOCAL_PROGRESS_STORAGE_KEY, loadCampaignCompletion } from '../scenes/sceneShared';
import { saveInitialRunSetup, validateInitialRunSetup, INITIAL_SETUP_STORAGE_KEY, type InitialRunSetup } from '../run/InitialRunSetup';
import { collectRuntimeResources, type RuntimeResourceSnapshot } from './RuntimeResourceDiagnostics';

type Flat = boolean | string | number | null | Flat[] | { [key: string]: Flat };
type BridgeResult = Flat | { ok: false; code: string; message: string };
const failure = (code: string, message: string): BridgeResult => ({ ok: false, code, message });
const scalar = (value: unknown): Flat => value == null || ['boolean','string','number'].includes(typeof value) ? value as Flat : String(value);

export interface ProductionE2eBridge {
  getSnapshot(): BridgeResult; getMenuSnapshot(): BridgeResult; getCampaignSnapshot(): BridgeResult;
  getRuntimeSnapshot(): BridgeResult; getResourceSnapshot(): RuntimeResourceSnapshot;
  startNewGame(setup: InitialRunSetup): BridgeResult; continueGame(): BridgeResult;
  loadCanonicalNodeForQa(nodeId: string): BridgeResult; sendAction(action: string): BridgeResult;
  movePlayerToRuntimeObject(runtimeId: string): BridgeResult; defeatActiveEnemies(): BridgeResult;
  activateInteraction(runtimeId: string): BridgeResult; advanceDialogue(): BridgeResult;
  advanceCinematic(): BridgeResult; requestExit(runtimeId: string): BridgeResult;
  resetActiveRun(): BridgeResult; clearAllLocalData(): BridgeResult;
}

declare global { interface Window { __NWD_E2E__?: ProductionE2eBridge } }
const activeScene = (game: Phaser.Game): Phaser.Scene | undefined => game.scene.getScenes(true).find((scene) => scene.scene.key !== 'UIScene');
const definition = (game: Phaser.Game) => game.registry.get('campaignFlowDefinition') as CampaignFlowDefinition | undefined;
const node = (game: Phaser.Game) => game.registry.get('activeCampaignNode') as CampaignFlowNode | undefined;
const transitionBlocked = (game: Phaser.Game) => Boolean(game.registry.get('pendingCampaignTransition'));
const dispatch = (game: Phaser.Game, action: string, runtimeId?: string): BridgeResult => {
  if (transitionBlocked(game)) return failure('transition-in-progress', 'A canonical transition is already in progress.');
  const scene = activeScene(game); if (!scene) return failure('scene-not-active', 'No required scene is active.');
  const event = { action, runtimeId: runtimeId ?? null };
  scene.events.emit('nwd:e2e-action', event); window.dispatchEvent(new CustomEvent('nwd:e2e-action', { detail: event }));
  return { ok: true, action, runtimeId: runtimeId ?? null };
};
const pressEnter = (): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
};

export function installProductionE2eBridge(game: Phaser.Game, search = window.location.search): boolean {
  if (new URLSearchParams(search).get('e2e') !== '1') { delete window.__NWD_E2E__; return false; }
  const runtime = (): Record<string, Flat> => {
    const current = node(game); const nodes = definition(game)?.nodes ?? []; const diagnostics = window.__NWD_RUNTIME_DIAGNOSTICS__;
    return {
      nodeId: current?.id ?? null, nodeType: current?.type ?? null, canonicalIndex: current ? nodes.findIndex((item) => item.id === current.id) : -1,
      runtimeLevelId: diagnostics?.runtimeLevelId ?? null, sceneKey: current?.sceneKey ?? activeScene(game)?.scene.key ?? null,
      gameplayReady: diagnostics?.gameplayReady ?? Boolean(current), physicsEngine: 'arcade', tiledMapPath: diagnostics?.tiledMapPath ?? null,
      runtimeConfigPath: diagnostics?.runtimeConfigPath ?? current?.levelConfigPath ?? null, playerCount: diagnostics?.playerCount ?? 0,
      allyCount: diagnostics?.allyCount ?? 0, activeEnemyCount: diagnostics?.activeEnemyCount ?? 0,
      dynamicBodyCount: diagnostics?.dynamicBodyCount ?? 0, staticBodyCount: diagnostics?.staticBodyCount ?? 0,
      colliderCount: diagnostics?.colliderCount ?? 0, overlapCount: diagnostics?.overlapCount ?? 0,
      currentObjective: diagnostics?.currentObjective ?? scalar(game.registry.get('currentObjective')),
      objectiveProgress: diagnostics?.objectiveProgress ?? scalar(game.registry.get('objectiveProgress')),
      objectiveCompleted: diagnostics?.objectiveCompleted ?? false, exitReady: diagnostics?.exitReady ?? false,
      activeExitId: diagnostics?.activeExitId ?? null, transitionInProgress: transitionBlocked(game),
      checkpointId: diagnostics?.checkpointId ?? scalar(game.registry.get('checkpointId')),
      fatalError: diagnostics?.fatalError ?? scalar(game.registry.get('fatalError'))
    };
  };
  const bridge: ProductionE2eBridge = {
    getSnapshot: () => ({ menu: bridge.getMenuSnapshot(), campaign: bridge.getCampaignSnapshot(), runtime: runtime(), resources: collectRuntimeResources(game) } as unknown as Flat),
    getMenuSnapshot: () => { const state = game.registry.get('mainMenuState') as Record<string, unknown> | undefined; return state ? Object.fromEntries(Object.entries(state).map(([k,v]) => [k, scalar(v)])) : { ready: false }; },
    getCampaignSnapshot: () => ({ flowId: definition(game)?.flowId ?? null, canonicalNodeCount: definition(game)?.nodes.length ?? 0, cursor: game.registry.get('campaignFlowCursor') as number ?? 0, nodeId: node(game)?.id ?? null, completion: Boolean(loadCampaignCompletion()) }),
    getRuntimeSnapshot: runtime, getResourceSnapshot: () => collectRuntimeResources(game),
    startNewGame: (setup) => { const valid = validateInitialRunSetup(setup); if (!valid) return failure('invalid-setup','The requested setup is invalid.'); saveInitialRunSetup(valid); clearRunForNewGame(); const scene=activeScene(game); if(!scene)return failure('scene-not-active','Menu scene is not active.'); const manager=new SceneFlowManager(scene); const first=manager.startFromBeginning(); return first && manager.transitionToNode(first) ? {ok:true,nodeId:first.id} : failure('transition-rejected','Could not start the canonical campaign.'); },
    continueGame: () => { const menu=game.scene.getScene('MainMenuScene') as Phaser.Scene & { continueRun?:()=>void }; if(!game.scene.isActive('MainMenuScene') || typeof menu.continueRun!=='function')return failure('continue-unavailable','Compatible active progress is required.'); menu.continueRun(); return {ok:true}; },
    loadCanonicalNodeForQa: (nodeId) => { if(transitionBlocked(game))return failure('transition-in-progress','A canonical transition is already in progress.'); const scene=activeScene(game); const target=definition(game)?.nodes.find((item)=>item.id===nodeId); if(!scene||!target)return failure('invalid-node','The canonical node does not exist.'); return new SceneFlowManager(scene).transitionToNode(target,{e2eMode:true}) ? {ok:true,nodeId} : failure('transition-rejected','The runtime rejected the node.'); },
    sendAction: (action) => ['interact','pause','resume','confirm','cancel','move-left','move-right','jump','shoot'].includes(action) ? dispatch(game,action) : failure('invalid-action','The action is not allowed.'),
    movePlayerToRuntimeObject: (id) => id ? dispatch(game,'move-to-runtime-object',id) : failure('invalid-runtime-id','A runtimeId is required.'),
    defeatActiveEnemies: () => dispatch(game,'defeat-active-enemies'), activateInteraction: (id) => id ? dispatch(game,'activate-interaction',id) : failure('invalid-runtime-id','A runtimeId is required.'),
    advanceDialogue: () => { if(!game.scene.isActive('DialogueScene'))return failure('scene-not-active','DialogueScene is not active.'); pressEnter(); return {ok:true}; },
    advanceCinematic: () => { if(!game.scene.isActive('CinematicScene'))return failure('scene-not-active','CinematicScene is not active.'); pressEnter(); return {ok:true}; },
    requestExit: (id) => id ? dispatch(game,'request-exit',id) : failure('invalid-runtime-id','A runtimeId is required.'),
    resetActiveRun: () => { clearRunForNewGame(); return true; },
    clearAllLocalData: () => { [LOCAL_PROGRESS_STORAGE_KEY,CAMPAIGN_COMPLETION_STORAGE_KEY,INITIAL_SETUP_STORAGE_KEY].forEach((key)=>localStorage.removeItem(key)); return true; }
  };
  window.__NWD_E2E__ = Object.freeze(bridge); return true;
}
