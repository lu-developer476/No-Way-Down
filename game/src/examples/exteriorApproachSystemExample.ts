import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { ExteriorApproachSystem } from '../systems/ExteriorApproachSystem';

interface BuildExteriorApproachSystemExampleParams {
  scene: Phaser.Scene;
  players: Player[];
  corridorTopY: number;
  corridorBottomY: number;
  levelWidth: number;
  nextSceneKey: string;
  nextSpawnPoint: { x: number; y: number };
  backgroundLayers?: Phaser.GameObjects.Components.Tint[];
}

/**
 * Ejemplo de integración desacoplada de GameScene.
 *
 * - Crea un gradiente narrativo al acercarse a la salida.
 * - Aclara la iluminación del corredor sin assets binarios.
 * - Opcionalmente ajusta el tinte de capas de fondo existentes.
 */
export function buildExteriorApproachSystemExample(
  params: BuildExteriorApproachSystemExampleParams
): ExteriorApproachSystem {
  return new ExteriorApproachSystem(params.scene, params.players, {
    levelWidth: params.levelWidth,
    approachStartX: params.levelWidth * 0.62,
    corridorTopY: params.corridorTopY,
    corridorBottomY: params.corridorBottomY,
    exitZone: {
      x: params.levelWidth - 110,
      y: (params.corridorTopY + params.corridorBottomY) * 0.5,
      width: 220,
      height: params.corridorBottomY - params.corridorTopY
    },
    nextLevel: {
      sceneKey: params.nextSceneKey,
      spawnPoint: params.nextSpawnPoint
    },
    onNarrativeMessage: (message) => {
      params.scene.registry.set('interactionHint', message);
    },
    onTransitionStart: (message) => {
      params.scene.registry.set('interactionHint', message);
    },
    onBackgroundIntensityChange: (progress) => {
      params.backgroundLayers?.forEach((layer) => {
        const tint = Phaser.Display.Color.Interpolate.ColorWithColor(
          Phaser.Display.Color.ValueToColor(0x334155),
          Phaser.Display.Color.ValueToColor(0xf8fafc),
          100,
          Math.round(progress * 100)
        );

        layer.setTint(Phaser.Display.Color.GetColor(tint.r, tint.g, tint.b));
      });
    }
  });
}
