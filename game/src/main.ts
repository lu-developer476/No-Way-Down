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
const MIN_DESKTOP_WIDTH = 1024;
const MIN_DESKTOP_HEIGHT = 640;
const UNSUPPORTED_MESSAGE = 'No Way Down solo está disponible en desktop o laptop';

const appContainer = document.getElementById('app');
const unsupportedScreen = document.getElementById('unsupported-screen');
let game: Phaser.Game | null = null;

if (!appContainer || !unsupportedScreen) {
  throw new Error('Missing required game container elements');
}

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: appContainer,
  backgroundColor: '#111827',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
    expandParent: true
  },
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

const isUnsupportedScreen = (): boolean => {
  const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  const isPortrait = window.matchMedia('(orientation: portrait)').matches;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const tooSmall = width < MIN_DESKTOP_WIDTH || height < MIN_DESKTOP_HEIGHT;
  return isTouchDevice || isPortrait || tooSmall;
};

const showUnsupportedScreen = () => {
  unsupportedScreen.textContent = UNSUPPORTED_MESSAGE;
  unsupportedScreen.hidden = false;
  appContainer.hidden = true;
  document.body.classList.add('unsupported-device');
};

const hideUnsupportedScreen = () => {
  unsupportedScreen.hidden = true;
  appContainer.hidden = false;
  document.body.classList.remove('unsupported-device');
};

const mountGame = () => {
  if (game) {
    return;
  }

  hideUnsupportedScreen();
  game = new Phaser.Game(config);
};

const unmountGame = () => {
  if (!game) {
    return;
  }

  game.destroy(true);
  game = null;
};

const syncGameAvailability = () => {
  if (isUnsupportedScreen()) {
    unmountGame();
    showUnsupportedScreen();
    return;
  }

  mountGame();
};

window.addEventListener('resize', syncGameAvailability);
window.addEventListener('orientationchange', syncGameAvailability);

syncGameAvailability();
