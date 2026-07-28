import type Phaser from 'phaser';
import type { CampaignFlowDefinition, CampaignFlowNode } from '../scenes/SceneFlowManager';
import { SceneFlowManager } from '../scenes/SceneFlowManager';
import { isCampaignQaRequested, QA_CAMPAIGN_STORAGE_NAMESPACE } from './CampaignQaMode';


/** Technical, query-gated campaign entry point. It never mutates normal save storage. */
export class CampaignQaNavigator {
  private root?: HTMLDivElement;
  private keyHandler?: (event: KeyboardEvent) => void;
  private nodes: CampaignFlowNode[] = [];
  private index = 0;

  private readonly scene: Phaser.Scene;
  private readonly search: string;
  constructor(scene: Phaser.Scene, search = window.location.search) { this.scene = scene; this.search = search; }

  mount(definition: CampaignFlowDefinition): boolean {
    if (!isCampaignQaRequested(this.search)) return false;
    this.nodes = definition.nodes.filter((node) => node.type === 'level' || node.type === 'cinematic');
    this.scene.registry.set('qaCampaignMode', true);
    this.scene.registry.set('qaCampaignStorageNamespace', QA_CAMPAIGN_STORAGE_NAMESPACE);
    this.render();
    this.keyHandler = (event) => this.onKey(event);
    window.addEventListener('keydown', this.keyHandler);
    return true;
  }

  close(): void {
    if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler);
    this.root?.remove();
    this.scene.registry.remove('qaCampaignMode');
    this.scene.registry.remove('qaCampaignStorageNamespace');
    this.scene.registry.remove('qaCampaignSelectedNode');
    this.scene.scene.stop('LevelScene');
    this.scene.scene.stop('CinematicScene');
    this.scene.scene.start('MainMenuScene');
  }

  loadNode(nodeId: string): boolean {
    const index = this.nodes.findIndex((node) => node.id === nodeId);
    if (index < 0) return false;
    const node = this.nodes[index];
    if (!node.levelConfigPath && !node.cinematicPath) return false;
    this.index = index;
    this.scene.registry.remove('pendingCampaignTransition');
    this.scene.registry.set('qaCampaignSelectedNode', { nodeId: node.id, state: 'loading' });
    this.stopCampaignScenes();
    const loaded = new SceneFlowManager(this.scene).transitionToNode(node, { qaCampaignMode: true });
    this.scene.registry.set('qaCampaignSelectedNode', {
      nodeId: node.id,
      runtimeLevelId: this.runtimeLevelId(node),
      state: loaded ? 'loaded' : 'not-loadable'
    });
    this.updateStatus();
    return loaded;
  }

  private render(): void {
    const root = document.createElement('div');
    root.id = 'nwd-campaign-qa';
    root.style.cssText = 'position:fixed;right:8px;top:8px;z-index:99999;width:330px;padding:8px;background:#090b10e8;border:1px solid #eab308;color:#f8fafc;font:11px monospace';
    root.innerHTML = '<strong style="color:#fde047">QA CAMPAIGN — PROGRESO NO PERSISTENTE</strong><div data-qa-controls></div><div data-qa-status style="margin-top:5px;color:#cbd5e1"></div>';
    const controls = root.querySelector('[data-qa-controls]')!;
    const nodeSelect = this.makeSelect(this.nodes.map((node) => [node.id, node.id]), (value) => this.loadNode(value));
    nodeSelect.setAttribute('aria-label', 'nodeId');
    const runtimeNodes = this.nodes.filter((node) => this.runtimeLevelId(node));
    const runtimeSelect = this.makeSelect(runtimeNodes.map((node) => [node.id, this.runtimeLevelId(node)!]), (value) => this.loadNode(value));
    runtimeSelect.setAttribute('aria-label', 'runtimeLevelId');
    controls.append(nodeSelect, runtimeSelect);
    [['◀', () => this.move(-1)], ['▶', () => this.move(1)], ['↻', () => this.reload()], ['Menú', () => this.close()]].forEach(([label, action]) => {
      const button = document.createElement('button'); button.textContent = String(label); button.onclick = action as () => void; controls.append(button);
    });
    document.body.append(root); this.root = root; this.updateStatus();
  }

  private makeSelect(options: string[][], action: (value: string) => void): HTMLSelectElement {
    const select = document.createElement('select'); select.style.cssText = 'display:block;width:100%;margin:5px 0;background:#111827;color:white';
    options.forEach(([value, label]) => { const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option); });
    select.onchange = () => action(select.value); return select;
  }

  private runtimeLevelId(node: CampaignFlowNode): string | undefined {
    if (!node.levelConfigPath) return undefined;
    const config = this.scene.cache.json.get(`campaign_level::${node.levelConfigPath}`) as { runtimeLevelId?: string } | undefined;
    return config?.runtimeLevelId ?? node.levelConfigPath.split('/').pop()?.replace('.json', '');
  }

  private move(delta: number): void { this.loadNode(this.nodes[Math.max(0, Math.min(this.nodes.length - 1, this.index + delta))].id); }
  private reload(): void { this.loadNode(this.nodes[this.index].id); }
  private stopCampaignScenes(): void { ['LevelScene', 'CinematicScene', 'DialogueScene', 'CampaignIntroScene'].forEach((key) => { if (this.scene.scene.isActive(key)) this.scene.scene.stop(key); }); }
  private updateStatus(): void { const status = this.root?.querySelector('[data-qa-status]'); if (status) status.textContent = `Nodo ${this.index + 1}/${this.nodes.length}: ${this.nodes[this.index]?.id ?? 'sin nodos'}`; }
  private onKey(event: KeyboardEvent): void {
    if (event.key === 'PageUp') this.move(-1); else if (event.key === 'PageDown') this.move(1);
    else if (event.key === 'Home') this.loadNode(this.nodes.find((node) => node.type === 'level')?.id ?? '');
    else if (event.key === 'End') this.loadNode([...this.nodes].reverse().find((node) => node.type === 'level')?.id ?? '');
    else if (event.key.toLowerCase() === 'r') this.reload(); else if (event.key === 'Escape') this.close(); else return;
    event.preventDefault();
  }
}
