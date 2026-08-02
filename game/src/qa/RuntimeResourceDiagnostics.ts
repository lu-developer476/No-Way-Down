import type Phaser from 'phaser';

export interface RuntimeResourceSnapshot {
  activeSceneKeys: string[]; textureCount: number; generatedTextureCount: number; animationCount: number;
  timerCount: number; tweenCount: number; inputListenerCount: number; registryListenerCount: number;
  sceneListenerCount: number; arcadeDynamicBodyCount: number; arcadeStaticBodyCount: number;
  colliderCount: number; overlapCount: number; playerCount: number; allyCount: number; zombieCount: number;
  projectileCount: number; effectCount: number; audioLoopCount: number; environmentObjectCount: number;
  minimapMarkerCount: number;
}

const finite = (value: unknown): number => typeof value === 'number' && Number.isFinite(value) ? value : 0;
export function collectRuntimeResources(game: Phaser.Game): RuntimeResourceSnapshot {
  const registry = game.registry;
  const activeSceneKeys = game.scene.getScenes(true).map((scene) => scene.scene.key);
  const count = (key: string) => finite(registry.get(key));
  return {
    activeSceneKeys, textureCount: game.textures.getTextureKeys().length,
    generatedTextureCount: game.textures.getTextureKeys().filter((key) => key.startsWith('generated-')).length,
    animationCount: game.anims.toJSON().anims.length, timerCount: count('qaTimerCount'), tweenCount: count('qaTweenCount'),
    inputListenerCount: count('qaInputListenerCount'), registryListenerCount: count('qaRegistryListenerCount'),
    sceneListenerCount: count('qaSceneListenerCount'), arcadeDynamicBodyCount: count('arcadeDynamicBodyCount'),
    arcadeStaticBodyCount: count('arcadeStaticBodyCount'), colliderCount: count('colliderCount'), overlapCount: count('overlapCount'),
    playerCount: count('playerCount'), allyCount: count('allyCount'), zombieCount: count('activeEnemyCount'),
    projectileCount: count('projectileCount'), effectCount: count('effectCount'), audioLoopCount: count('audioLoopCount'),
    environmentObjectCount: count('environmentObjectCount'), minimapMarkerCount: count('minimapMarkerCount')
  };
}
