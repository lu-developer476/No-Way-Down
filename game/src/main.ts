import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { UpperFloorScene } from './scenes/UpperFloorScene';

const GAME_WIDTH = 960;
const GAME_HEIGHT = 540;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'app',
  backgroundColor: '#111827',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 700 },
      debug: false
    }
  },
  scene: [BootScene, GameScene, UpperFloorScene, UIScene]
};

void new Phaser.Game(config);
