import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { AssetPreloadScene } from './scenes/AssetPreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { CampaignIntroScene } from './scenes/CampaignIntroScene';
import { LevelScene } from './scenes/LevelScene';
import { CinematicScene } from './scenes/CinematicScene';
import { DialogueScene } from './scenes/DialogueScene';
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
  scene: [
    BootScene,
    AssetPreloadScene,
    MainMenuScene,
    CampaignIntroScene,
    LevelScene,
    CinematicScene,
    DialogueScene,
    UpperFloorScene,
    UIScene
  ]
};

void new Phaser.Game(config);
