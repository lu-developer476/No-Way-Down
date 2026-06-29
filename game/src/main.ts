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
const MIN_DESKTOP_WIDTH = 960;
const MIN_DESKTOP_HEIGHT = 540;
const UNSUPPORTED_MESSAGE = 'No Way Down solo está disponible en desktop o laptop';
const LOAD_ERROR_MESSAGE = 'No Way Down no pudo iniciar. Recargá la página y, si sigue fallando, revisá la consola del navegador.';

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
  pixelArt: true,
  antialias: false,
  roundPixels: true,
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

const showBlockingMessage = (message: string) => {
  unsupportedScreen.textContent = message;
  unsupportedScreen.hidden = false;
  appContainer.hidden = true;
};

const showUnsupportedScreen = () => {
  showBlockingMessage(UNSUPPORTED_MESSAGE);
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
  try {
    game = new Phaser.Game(config);
  } catch (error) {
    console.error('[NoWayDown] Error iniciando Phaser.', error);
    showBlockingMessage(LOAD_ERROR_MESSAGE);
  }
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

window.addEventListener('error', (event) => {
  console.error('[NoWayDown] Error global de carga.', event.error ?? event.message);
  showBlockingMessage(LOAD_ERROR_MESSAGE);
});
window.addEventListener('unhandledrejection', (event) => {
  console.error('[NoWayDown] Promesa rechazada durante la carga.', event.reason);
  showBlockingMessage(LOAD_ERROR_MESSAGE);
});
window.addEventListener('resize', syncGameAvailability);
window.addEventListener('orientationchange', syncGameAvailability);

syncGameAvailability();
