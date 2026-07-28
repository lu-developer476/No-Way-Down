import Phaser from 'phaser';
import type {CampaignNode,CanonicalManifest} from '../campaign/types';
import {RegistryKeys} from '../config/RegistryKeys';
import {TiledLevelLoader} from '../tiled/TiledLevelLoader';
import {TiledLevelRepository} from '../tiled/TiledLevelRepository';
import {migrateSave} from '../runtime/SaveMigration';

interface LevelWrapper { runtimeLevelId?: string }
const LOAD_TIMEOUT_MS = 15_000;

/** Retained for the future Tiled rollout; production currently uses the Arcade campaign scenes. */
export class LevelLoadingScene extends Phaser.Scene {
  private node?: CampaignNode;
  private message?: Phaser.GameObjects.Text;
  private loadingInProgress = false;
  private retryInProgress = false;
  private retryUsed = false;
  private timeout?: ReturnType<typeof setTimeout>;

  constructor() { super('LevelLoadingScene'); }

  create(data: {node: CampaignNode}): void {
    this.node = data.node;
    this.message = this.add.text(480, 250, 'Cargando nivel…', {fontFamily:'monospace',fontSize:'20px',color:'#ffffff',align:'center'}).setOrigin(.5);
    this.input.keyboard?.on('keydown-R', this.retry, this);
    this.input.keyboard?.on('keydown-ESC', this.returnToMenu, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    void this.run('initial');
  }

  private async json(path: string): Promise<unknown> {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${path}`);
    return response.json() as Promise<unknown>;
  }

  private async run(phase: 'initial'|'explicit-retry'): Promise<void> {
    if (this.loadingInProgress || (phase === 'explicit-retry' && this.retryUsed)) return;
    this.loadingInProgress = true;
    if (phase === 'explicit-retry') { this.retryInProgress = true; this.retryUsed = true; }
    let runtimeLevelId = 'unresolved';
    try {
      const timeout = new Promise<never>((_, reject) => { this.timeout = setTimeout(() => reject(new Error(`Level load timed out after ${LOAD_TIMEOUT_MS}ms`)), LOAD_TIMEOUT_MS); });
      await Promise.race([(async () => {
        const manifest = this.registry.get(RegistryKeys.manifest) as CanonicalManifest;
        const repository = await new TiledLevelRepository().create(manifest, path => this.json(path));
        const identity = repository.forNode(this.node!.id); runtimeLevelId = identity.runtimeLevelId;
        void migrateSave({nodeId:this.node!.id,runtimeLevelId}, () => runtimeLevelId);
        const wrapper = await this.json(this.node!.levelConfigPath!) as LevelWrapper;
        const level = await new TiledLevelLoader(this).load(identity.mapPath);
        this.registry.set(RegistryKeys.loadedLevel, level);
        this.registry.remove(RegistryKeys.fatalError);
        this.scene.start('LevelScene', {node:this.node!,wrapper,level});
      })(), timeout]);
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error(String(cause));
      console.error('[LevelLoadingScene] load failed', {nodeId:this.node?.id,runtimeLevelId,phase,stack:error.stack});
      this.registry.set(RegistryKeys.fatalError, error);
      this.message?.setText(`No se pudo cargar el nivel\n${error.message}\n\nR: reintentar una vez   ESC: menú`);
    } finally {
      if (this.timeout) clearTimeout(this.timeout);
      this.timeout = undefined; this.loadingInProgress = false; this.retryInProgress = false;
    }
  }

  private retry(): void { if (!this.loadingInProgress && !this.retryInProgress && !this.retryUsed) void this.run('explicit-retry'); }
  private returnToMenu(): void { if (!this.loadingInProgress) this.scene.start('MainMenuScene'); }
  private cleanup(): void {
    if (this.timeout) clearTimeout(this.timeout);
    this.load.removeAllListeners();
    this.input.keyboard?.off('keydown-R', this.retry, this);
    this.input.keyboard?.off('keydown-ESC', this.returnToMenu, this);
  }
}
