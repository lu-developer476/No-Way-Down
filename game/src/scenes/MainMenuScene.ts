import Phaser from 'phaser';
import {
  GameDifficulty,
  hasCompatibleLocalProgress,
  InitialRunSetup,
  PlayableProtagonist,
  saveInitialRunSetup
} from './sceneShared';
import { getAudioManager } from '../audio/AudioManager';
import { SceneFlowManager } from './SceneFlowManager';
import { controlManager } from '../input/ControlManager';

interface MenuOption {
  label: string;
  action: () => void;
}

interface SetupState {
  protagonist?: PlayableProtagonist;
  difficulty?: GameDifficulty;
  optionalParty: Set<string>;
}

interface SetupActionOption {
  label: string;
  action: () => void;
}

type UiStyles = {
  'font-title': Phaser.Types.GameObjects.Text.TextStyle;
  'font-menu': Phaser.Types.GameObjects.Text.TextStyle;
  'font-subtext': Phaser.Types.GameObjects.Text.TextStyle;
  'panel-background': {
    fillColor: number;
    fillAlpha: number;
    strokeColor: number;
    strokeAlpha: number;
  };
  'highlight-color': string;
};

type SetupStep = 'protagonist' | 'difficulty' | 'party' | 'confirm';

const REQUIRED_PARTY = ['Alan Nahuel', 'Giovanna', 'Damián', 'Nahir'] as const;
const OPTIONAL_PARTY = ['Celestino', 'Hernán', 'Yamil'] as const;

const UI_STYLES: UiStyles = {
  'font-title': {
    color: '#f8fafc',
    fontSize: '28px',
    fontFamily: '"Courier New", monospace'
  },
  'font-menu': {
    color: '#cbd5e1',
    fontSize: '18px',
    fontFamily: '"Courier New", monospace'
  },
  'font-subtext': {
    color: '#94a3b8',
    fontSize: '13px',
    fontFamily: '"Courier New", monospace'
  },
  'panel-background': {
    fillColor: 0x020617,
    fillAlpha: 0.62,
    strokeColor: 0x0ea5e9,
    strokeAlpha: 0.34
  },
  'highlight-color': '#fde047'
};

export class MainMenuScene extends Phaser.Scene {
  private menuOptions: MenuOption[] = [];
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private optionBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  private menuBar?: Phaser.GameObjects.Rectangle;
  private menuHintText?: Phaser.GameObjects.Text;
  private selectedIndex = 0;
  private controlsPanel?: Phaser.GameObjects.Container;
  private controlsBackButtonBg?: Phaser.GameObjects.Rectangle;
  private controlsBackButtonText?: Phaser.GameObjects.Text;
  private setupPanel?: Phaser.GameObjects.Container;
  private setupHintText?: Phaser.GameObjects.Text;
  private setupStep: SetupStep = 'protagonist';
  private setupState: SetupState = { optionalParty: new Set<string>() };
  private setupActionOptions: SetupActionOption[] = [];
  private setupOptionTexts: Phaser.GameObjects.Text[] = [];
  private setupSelectedIndex = 0;
  private volumeOptionIndex = -1;

  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    const audioManager = getAudioManager(this);
    this.registry.set('audioMuted', audioManager.isMuted());
    this.registry.set('audioVolume', audioManager.getVolumePercent());
    audioManager.playMenuMusic();

    this.buildBackground();
    this.buildMenuOptions();
    this.buildControlsPanel();
    this.buildSetupPanel();
    this.registerMenuInputs();
    this.refreshMenuSelection();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    });
  }

  private buildBackground(): void {
    const { width, height } = this.scale;

    if (this.textures.exists('menu_background')) {
      this.add.image(width / 2, height / 2, 'menu_background')
        .setDisplaySize(width, height)
        .setAlpha(0.96);
      this.add.rectangle(width / 2, height / 2, width, height, 0x020617, 0.36);
      return;
    }

    this.add.rectangle(width / 2, height / 2, width, height, 0x0f172a, 1);
  }

  private buildMenuOptions(): void {
    const { width, height } = this.scale;

    this.menuOptions = [
      {
        label: 'Nueva partida',
        action: () => this.openSetupFlow()
      },
      {
        label: 'Continuar',
        action: () => this.continueRun()
      },
      {
        label: 'Opciones',
        action: () => this.toggleControlsPanel(true)
      },
      {
        label: 'Salir',
        action: () => this.exitGame()
      }
    ];
    this.volumeOptionIndex = -1;

    this.menuBar = this.add.rectangle(
      width / 2,
      height - 68,
      width - 56,
      54,
      UI_STYLES['panel-background'].fillColor,
      UI_STYLES['panel-background'].fillAlpha
    ).setStrokeStyle(1, UI_STYLES['panel-background'].strokeColor, UI_STYLES['panel-background'].strokeAlpha);

    this.optionTexts = this.menuOptions.map((option) => this.add.text(0, 0, option.label, UI_STYLES['font-menu'])
      .setOrigin(0.5)
      .setDepth(4));

    this.optionBackgrounds = this.menuOptions.map(() => this.add.rectangle(0, 0, 0, 42, 0x020617, 0.7)
      .setStrokeStyle(1, 0x334155, 0.85)
      .setDepth(3));

    this.layoutMenuOptions();

    this.menuHintText = this.add.text(width / 2, height - 26, '← → seleccionar · ENTER confirmar · ESC volver', UI_STYLES['font-subtext'])
      .setOrigin(0.5)
      .setDepth(4);
  }

  private buildControlsPanel(): void {
    const { width, height } = this.scale;

    const panelWidth = 620;
    const panelHeight = 420;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x020617, 0.76);
    const panelFrame = this.add.rectangle(width / 2, height / 2, panelWidth, panelHeight, 0x020617, 0.96)
      .setStrokeStyle(3, 0x38bdf8, 1);
    const panelInner = this.add.rectangle(width / 2, height / 2, panelWidth - 14, panelHeight - 14, 0x020617, 0.78)
      .setStrokeStyle(1, 0x93c5fd, 0.6);

    const panelArtwork = this.textures.exists('menu_background')
      ? this.add.image(width / 2, height / 2, 'menu_background').setDisplaySize(panelWidth - 20, panelHeight - 20).setAlpha(0.36)
      : this.add.rectangle(width / 2, height / 2, panelWidth - 20, panelHeight - 20, 0x0f172a, 0.85);

    const panelTint = this.add.rectangle(width / 2, height / 2, panelWidth - 20, panelHeight - 20, 0x020617, 0.62);

    const title = this.add.text(width / 2, height / 2 - 154, 'OPCIONES', {
      ...UI_STYLES['font-title'],
      fontSize: '34px'
    }).setOrigin(0.5);

    const controlsLabel = this.add.text(width / 2, height / 2 - 114, 'CONTROLES', {
      ...UI_STYLES['font-subtext'],
      color: '#bae6fd',
      fontSize: '18px',
      letterSpacing: 2
    }).setOrigin(0.5);

    const body = this.add.text(width / 2, height / 2 - 4, [
      `Movimiento: ${controlManager.getMovementDisplayLabel()}`,
      `Saltar: ${controlManager.getDisplayLabel('jump')}`,
      `Disparar: ${controlManager.getDisplayLabel('shoot')}`,
      `Recargar: ${controlManager.getDisplayLabel('reload')}`,
      `Interactuar: ${controlManager.getDisplayLabel('interact')}`,
      `Siguiente nivel: ${controlManager.getDisplayLabel('next_level')}`,
      `Pausa: ${controlManager.getDisplayLabel('pause')}`,
      `Abandonar partida: ${controlManager.getDisplayLabel('quit')}`
    ].join('\n'), {
      color: '#cbd5e1',
      fontSize: '20px',
      align: 'center',
      fontFamily: '"Courier New", monospace',
      lineSpacing: 8
    }).setOrigin(0.5);

    this.controlsBackButtonBg = this.add.rectangle(width / 2, height / 2 + 156, 220, 46, 0x1e293b, 0.95)
      .setStrokeStyle(2, 0xfde047, 1)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.toggleControlsPanel(false));

    this.controlsBackButtonText = this.add.text(width / 2, height / 2 + 156, 'Volver', {
      color: '#fde047',
      fontSize: '22px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5);

    this.controlsPanel = this.add.container(0, 0, [
      overlay,
      panelFrame,
      panelArtwork,
      panelTint,
      panelInner,
      title,
      controlsLabel,
      body,
      this.controlsBackButtonBg,
      this.controlsBackButtonText
    ]).setVisible(false).setDepth(10);
  }

  private buildSetupPanel(): void {
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x020617, 0.74);
    const panel = this.add.rectangle(width / 2, height / 2, 760, 420, 0x020617, 0.95)
      .setStrokeStyle(2, 0x38bdf8, 1);

    const title = this.add.text(width / 2, height / 2 - 176, 'Nueva partida', {
      color: '#f8fafc',
      fontSize: '28px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5);

    const subtitle = this.add.text(width / 2, height / 2 - 138, '', {
      color: '#bfdbfe',
      fontSize: '18px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5);

    const characterArt = this.textures.exists('characters_panel')
      ? this.add.image(width / 2, height / 2 - 52, 'characters_panel').setDisplaySize(320, 140).setAlpha(0.88)
      : this.add.rectangle(width / 2, height / 2 - 52, 320, 140, 0x0f172a, 0.8).setStrokeStyle(1, 0x1d4ed8, 0.7);

    this.setupOptionTexts = [0, 1, 2, 3].map((index) => this.add.text(width / 2, height / 2 + 24 + index * 38, '', {
      color: '#cbd5e1',
      fontSize: '24px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5));

    this.setupHintText = this.add.text(width / 2, height / 2 + 178, '', {
      color: '#93c5fd',
      fontSize: '14px',
      align: 'center',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5);

    this.setupPanel = this.add.container(0, 0, [overlay, panel, title, subtitle, characterArt, ...this.setupOptionTexts, this.setupHintText])
      .setVisible(false)
      .setDepth(20);

    this.setupPanel.setData('subtitle', subtitle);
  }

  private registerMenuInputs(): void {
    this.input.keyboard?.on('keydown-UP', () => {
      if (this.controlsPanel?.visible) {
        return;
      }

      if (this.setupPanel?.visible) {
        this.setupSelectedIndex = Phaser.Math.Wrap(this.setupSelectedIndex - 1, 0, this.setupActionOptions.length);
        this.refreshSetupSelection();
        return;
      }

      this.selectedIndex = Phaser.Math.Wrap(this.selectedIndex - 1, 0, this.menuOptions.length);
      this.refreshMenuSelection();
    });

    this.input.keyboard?.on('keydown-DOWN', () => {
      if (this.controlsPanel?.visible) {
        return;
      }

      if (this.setupPanel?.visible) {
        this.setupSelectedIndex = Phaser.Math.Wrap(this.setupSelectedIndex + 1, 0, this.setupActionOptions.length);
        this.refreshSetupSelection();
        return;
      }

      this.selectedIndex = Phaser.Math.Wrap(this.selectedIndex + 1, 0, this.menuOptions.length);
      this.refreshMenuSelection();
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.controlsPanel?.visible) {
        this.toggleControlsPanel(false);
        return;
      }

      if (this.setupPanel?.visible) {
        this.setupActionOptions[this.setupSelectedIndex]?.action();
        return;
      }

      this.menuOptions[this.selectedIndex]?.action();
      getAudioManager(this).play('uiConfirm');
    });

    this.input.keyboard?.on('keydown-LEFT', () => {
      if (this.controlsPanel?.visible) {
        return;
      }

      if (this.setupPanel?.visible) {
        return;
      }

      this.selectedIndex = Phaser.Math.Wrap(this.selectedIndex - 1, 0, this.menuOptions.length);
      this.refreshMenuSelection();

    });

    this.input.keyboard?.on('keydown-RIGHT', () => {
      if (this.controlsPanel?.visible) {
        return;
      }

      if (this.setupPanel?.visible) {
        return;
      }

      this.selectedIndex = Phaser.Math.Wrap(this.selectedIndex + 1, 0, this.menuOptions.length);
      this.refreshMenuSelection();

    });

    this.input.keyboard?.on(controlManager.getPhaserEventName('quit'), () => {
      if (this.controlsPanel?.visible) {
        this.toggleControlsPanel(false);
        return;
      }

      if (this.setupPanel?.visible) {
        this.closeSetupFlow();
      }
    });

    this.input.keyboard?.on(controlManager.getPhaserEventName('next_level'), () => {
      if (this.controlsPanel?.visible) {
        this.toggleControlsPanel(false);
      }
    });

    this.optionTexts.forEach((text, index) => {
      text.setInteractive({ useHandCursor: true })
        .on('pointerover', () => {
          this.selectedIndex = index;
          this.refreshMenuSelection();
        })
        .on('pointerdown', () => {
          this.menuOptions[index]?.action();
          getAudioManager(this).play('uiConfirm');
        });
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllListeners();
    });
  }

  private refreshMenuSelection(): void {
    this.optionTexts.forEach((text, index) => {
      const isSelected = this.selectedIndex === index;
      text.setColor(isSelected ? UI_STYLES['highlight-color'] : '#cbd5e1');
      text.setScale(isSelected ? 1.04 : 1);
      this.optionBackgrounds[index]
        ?.setFillStyle(isSelected ? 0x1e293b : 0x020617, isSelected ? 0.9 : 0.7)
        .setStrokeStyle(1, isSelected ? 0xfde047 : 0x334155, isSelected ? 0.92 : 0.85);
    });
  }

  private layoutMenuOptions(): void {
    const { width, height } = this.scale;
    const menuY = height - 68;
    const minGap = width < 900 ? 10 : 14;
    const itemPaddingX = width < 900 ? 14 : 18;
    const maxLayoutWidth = width - 88;

    let fontSize = width < 900 ? 15 : 18;
    this.optionTexts.forEach((text) => text.setFontSize(fontSize));

    let itemWidths = this.optionTexts.map((text) => Math.ceil(text.width) + itemPaddingX * 2);
    let totalWidth = itemWidths.reduce((sum, itemWidth) => sum + itemWidth, 0) + minGap * (itemWidths.length - 1);

    if (totalWidth > maxLayoutWidth) {
      fontSize = Math.max(13, fontSize - 2);
      this.optionTexts.forEach((text) => text.setFontSize(fontSize));
      itemWidths = this.optionTexts.map((text) => Math.ceil(text.width) + itemPaddingX * 2);
      totalWidth = itemWidths.reduce((sum, itemWidth) => sum + itemWidth, 0) + minGap * (itemWidths.length - 1);
    }

    this.menuBar?.setPosition(width / 2, menuY).setSize(Math.min(width - 56, totalWidth + 36), 54);

    let currentX = width / 2 - totalWidth / 2;
    this.optionTexts.forEach((text, index) => {
      const itemWidth = itemWidths[index] ?? 0;
      const centerX = currentX + itemWidth / 2;
      this.optionBackgrounds[index]?.setPosition(centerX, menuY).setSize(itemWidth, 36);
      text.setPosition(centerX, menuY);
      currentX += itemWidth + minGap;
    });

    this.menuHintText?.setPosition(width / 2, height - 24);
  }

  private adjustMasterVolume(delta: number): void {
    const audioManager = getAudioManager(this);
    const volume = audioManager.adjustVolumePercent(delta);
    this.registry.set('audioVolume', volume);
    this.refreshVolumeOptionLabel();

    if (!audioManager.isMuted() && volume > 0) {
      audioManager.play('uiConfirm');
    }
  }

  private refreshVolumeOptionLabel(): void {
    if (this.volumeOptionIndex < 0 || !this.menuOptions[this.volumeOptionIndex]) {
      return;
    }

    const volume = getAudioManager(this).getVolumePercent();
    const label = `Volumen: ${volume}%`;
    this.menuOptions[this.volumeOptionIndex].label = label;
    this.optionTexts[this.volumeOptionIndex]?.setText(label);
    this.layoutMenuOptions();
  }

  private handleResize(): void {
    const { width, height } = this.scale;

    this.menuHintText?.setPosition(width / 2, height - 24);
    this.layoutMenuOptions();

    if (this.controlsPanel) {
      const [overlay, panelFrame, panelArtwork, panelTint, panelInner, title, controlsLabel, body, backButtonBg, backButtonText] = this.controlsPanel.list as [
        Phaser.GameObjects.Rectangle,
        Phaser.GameObjects.Rectangle,
        Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle,
        Phaser.GameObjects.Rectangle,
        Phaser.GameObjects.Rectangle,
        Phaser.GameObjects.Text,
        Phaser.GameObjects.Text,
        Phaser.GameObjects.Text,
        Phaser.GameObjects.Rectangle,
        Phaser.GameObjects.Text
      ];
      const panelWidth = Math.min(620, width - 84);
      const panelHeight = Math.min(420, height - 70);
      overlay.setPosition(width / 2, height / 2).setSize(width, height);
      panelFrame.setPosition(width / 2, height / 2).setSize(panelWidth, panelHeight);
      panelInner.setPosition(width / 2, height / 2).setSize(panelWidth - 14, panelHeight - 14);
      panelArtwork.setPosition(width / 2, height / 2).setDisplaySize(panelWidth - 20, panelHeight - 20);
      panelTint.setPosition(width / 2, height / 2).setSize(panelWidth - 20, panelHeight - 20);

      title.setPosition(width / 2, height / 2 - panelHeight * 0.37);
      controlsLabel.setPosition(width / 2, height / 2 - panelHeight * 0.27);
      body.setPosition(width / 2, height / 2 - panelHeight * 0.02);
      backButtonBg.setPosition(width / 2, height / 2 + panelHeight * 0.37);
      backButtonText.setPosition(width / 2, height / 2 + panelHeight * 0.37);
    }

    if (this.setupPanel) {
      const [overlay, panel, title, subtitle, characterArt, ...rest] = this.setupPanel.list as Phaser.GameObjects.GameObject[];
      (overlay as Phaser.GameObjects.Rectangle).setPosition(width / 2, height / 2).setSize(width, height);
      (panel as Phaser.GameObjects.Rectangle).setPosition(width / 2, height / 2);
      (title as Phaser.GameObjects.Text).setPosition(width / 2, height / 2 - 176);
      (subtitle as Phaser.GameObjects.Text).setPosition(width / 2, height / 2 - 138);
      (characterArt as Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle).setPosition(width / 2, height / 2 - 52);

      this.setupOptionTexts.forEach((text, index) => {
        text.setPosition(width / 2, height / 2 + 24 + index * 38);
      });
      this.setupHintText?.setPosition(width / 2, height / 2 + 178);
      void rest;
    }
  }

  private refreshSetupSelection(): void {
    this.setupOptionTexts.forEach((text, index) => {
      const option = this.setupActionOptions[index];
      text.setVisible(Boolean(option));
      text.setText(option?.label ?? '');

      const selected = this.setupSelectedIndex === index;
      text.setColor(selected ? '#fde047' : '#cbd5e1');
      text.setScale(selected ? 1.03 : 1);
    });
  }

  private toggleControlsPanel(visible: boolean): void {
    this.controlsPanel?.setVisible(visible);
    this.controlsBackButtonBg
      ?.setFillStyle(visible ? 0x1e293b : 0x0f172a, 0.95)
      .setStrokeStyle(2, visible ? 0xfde047 : 0x93c5fd, 1);
    this.controlsBackButtonText?.setColor(visible ? '#fde047' : '#e2e8f0');
  }

  private openSetupFlow(): void {
    this.setupState = { optionalParty: new Set<string>() };
    this.setupStep = 'protagonist';
    this.setupSelectedIndex = 0;
    this.setupPanel?.setVisible(true);
    this.renderSetupStep();
  }

  private closeSetupFlow(): void {
    this.setupPanel?.setVisible(false);
    this.setupActionOptions = [];
    this.setupSelectedIndex = 0;
  }

  private renderSetupStep(): void {
    const subtitle = this.setupPanel?.getData('subtitle') as Phaser.GameObjects.Text | undefined;

    if (!subtitle) {
      return;
    }

    if (this.setupStep === 'protagonist') {
      subtitle.setText('Elegir protagonista');
      this.setupHintText?.setText('Confirmar: ENTER | Cancelar: ESC');
      this.setupActionOptions = [
        {
          label: this.withCheck(this.setupState.protagonist === 'alan', 'Alan Nahuel'),
          action: () => {
            this.setupState.protagonist = 'alan';
            this.setupStep = 'difficulty';
            this.setupSelectedIndex = 0;
            this.renderSetupStep();
          }
        },
        {
          label: this.withCheck(this.setupState.protagonist === 'giovanna', 'Giovanna'),
          action: () => {
            this.setupState.protagonist = 'giovanna';
            this.setupStep = 'difficulty';
            this.setupSelectedIndex = 0;
            this.renderSetupStep();
          }
        }
      ];
    }

    if (this.setupStep === 'difficulty') {
      subtitle.setText('Dificultad');
      this.setupHintText?.setText('Confirmar: ENTER | Cancelar: ESC');
      this.setupActionOptions = [
        {
          label: this.withCheck(this.setupState.difficulty === 'complejo', 'Complejo'),
          action: () => {
            this.setupState.difficulty = 'complejo';
            this.setupStep = 'party';
            this.setupSelectedIndex = 0;
            this.renderSetupStep();
          }
        },
        {
          label: this.withCheck(this.setupState.difficulty === 'pesadilla', 'Pesadilla'),
          action: () => {
            this.setupState.difficulty = 'pesadilla';
            this.setupStep = 'party';
            this.setupSelectedIndex = 0;
            this.renderSetupStep();
          }
        }
      ];
    }

    if (this.setupStep === 'party') {
      subtitle.setText('Personajes adicionales');
      this.setupHintText?.setText('Confirmar: ENTER | Cancelar: ESC');
      this.setupActionOptions = [
        ...OPTIONAL_PARTY.map((name) => ({
          label: this.withCheck(this.setupState.optionalParty.has(name), name),
          action: () => {
            if (this.setupState.optionalParty.has(name)) {
              this.setupState.optionalParty.delete(name);
            } else {
              this.setupState.optionalParty.add(name);
            }
            this.renderSetupStep();
          }
        })),
        {
          label: 'Finalizar',
          action: () => {
            this.setupStep = 'confirm';
            this.setupSelectedIndex = 0;
            this.renderSetupStep();
          }
        }
      ];
    }

    if (this.setupStep === 'confirm') {
      subtitle.setText('Confirmar partida');
      this.setupHintText?.setText('Confirmar: ENTER | Cancelar: ESC');
      this.setupActionOptions = [
        {
          label: 'Confirmar y comenzar',
          action: () => this.confirmSetupAndStart()
        },
        {
          label: 'Editar grupo',
          action: () => {
            this.setupStep = 'party';
            this.setupSelectedIndex = 0;
            this.renderSetupStep();
          }
        },
        {
          label: 'Cancelar',
          action: () => this.closeSetupFlow()
        }
      ];
    }

    this.refreshSetupSelection();
  }

  private confirmSetupAndStart(): void {
    if (!this.setupState.protagonist || !this.setupState.difficulty) {
      return;
    }

    const setup: InitialRunSetup = {
      protagonist: this.setupState.protagonist,
      difficulty: this.setupState.difficulty,
      party: {
        required: [...REQUIRED_PARTY],
        optional: OPTIONAL_PARTY.filter((name) => this.setupState.optionalParty.has(name))
      },
      startedAt: new Date().toISOString(),
      version: 1
    };

    saveInitialRunSetup(setup);
    this.registry.remove('checkpoint');
    this.registry.set('initialRunSetup', setup);
    getAudioManager(this).stopMenuMusic();
    this.scene.stop('UIScene');
    const flowManager = new SceneFlowManager(this);
    const firstNode = flowManager.startFromBeginning();
    if (!firstNode) {
      console.error('No se encontró el primer nodo de campaña.');
      return;
    }

    flowManager.transitionToNode(firstNode);
  }

  private withCheck(checked: boolean, label: string): string {
    return checked ? `✓ ${label}` : `  ${label}`;
  }

  private continueRun(): void {
    if (!this.hasSavedProgress()) {
      getAudioManager(this).play('uiConfirm');
      return;
    }

    getAudioManager(this).stopMenuMusic();
    this.scene.stop('UIScene');
    const flowManager = new SceneFlowManager(this);
    const firstNode = flowManager.startFromBeginning();
    if (firstNode) {
      flowManager.transitionToNode(firstNode);
    }
  }

  private hasSavedProgress(): boolean {
    return hasCompatibleLocalProgress();
  }

  private exitGame(): void {
    window.close();
  }
}
