import Phaser from 'phaser';
import { LOCAL_PROGRESS_STORAGE_KEY } from './sceneShared';
import { visualTheme } from './visualTheme';

interface MenuOption {
  label: string;
  action: () => void;
}

export class MainMenuScene extends Phaser.Scene {
  private menuOptions: MenuOption[] = [];
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private selectedIndex = 0;
  private controlsPanel?: Phaser.GameObjects.Container;

  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    this.buildBackground();
    this.buildTitle();
    this.buildMenuOptions();
    this.buildControlsPanel();
    this.registerMenuInputs();
    this.refreshMenuSelection();
  }

  private buildBackground(): void {
    const { width, height } = this.scale;

    this.add.rectangle(width / 2, height / 2, width, height, visualTheme.palette.skyTop, 1);
    this.add.rectangle(width / 2, height * 0.68, width, height * 0.64, visualTheme.palette.wallMid, 0.6);
    this.add.rectangle(width / 2, height - 58, width, 116, visualTheme.palette.floorDark, 0.8);
  }

  private buildTitle(): void {
    const { width } = this.scale;

    this.add.text(width / 2, 98, 'NO WAY DOWN', {
      color: '#f8fafc',
      fontSize: '54px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5);

    this.add.text(width / 2, 146, 'Escape cooperativo · supervivencia vertical', {
      color: '#cbd5e1',
      fontSize: '18px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5);
  }

  private buildMenuOptions(): void {
    this.menuOptions = [
      {
        label: 'Iniciar partida',
        action: () => this.startNewRun()
      }
    ];

    if (this.hasSavedProgress()) {
      this.menuOptions.push({
        label: 'Continuar',
        action: () => this.continueRun()
      });
    }

    this.menuOptions.push({
      label: 'Controles',
      action: () => this.toggleControlsPanel(true)
    });

    this.optionTexts = this.menuOptions.map((option, index) => this.add.text(this.scale.width / 2, 252 + index * 58, option.label, {
      color: '#cbd5e1',
      fontSize: '32px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5));

    this.add.text(this.scale.width / 2, this.scale.height - 34, '↑/↓ seleccionar · ENTER confirmar', {
      color: '#94a3b8',
      fontSize: '14px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5);
  }

  private buildControlsPanel(): void {
    const { width, height } = this.scale;

    const panel = this.add.rectangle(width / 2, height / 2, 520, 280, 0x020617, 0.94)
      .setStrokeStyle(2, 0x38bdf8, 1);

    const title = this.add.text(width / 2, height / 2 - 96, 'CONTROLES', {
      color: '#f8fafc',
      fontSize: '28px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5);

    const body = this.add.text(width / 2, height / 2 - 6, [
      'Mover: A / D',
      'Saltar: W o ESPACIO',
      'Disparar: F',
      'Guardar / Cargar: P / O',
      'Pausa: ESC'
    ].join('\n'), {
      color: '#cbd5e1',
      fontSize: '20px',
      align: 'center',
      fontFamily: '"Courier New", monospace',
      lineSpacing: 10
    }).setOrigin(0.5);

    const closeHint = this.add.text(width / 2, height / 2 + 108, 'ESC o ENTER para volver', {
      color: '#93c5fd',
      fontSize: '14px',
      fontFamily: '"Courier New", monospace'
    }).setOrigin(0.5);

    this.controlsPanel = this.add.container(0, 0, [panel, title, body, closeHint]).setVisible(false).setDepth(10);
  }

  private registerMenuInputs(): void {
    this.input.keyboard?.on('keydown-UP', () => {
      if (this.controlsPanel?.visible) {
        return;
      }

      this.selectedIndex = Phaser.Math.Wrap(this.selectedIndex - 1, 0, this.menuOptions.length);
      this.refreshMenuSelection();
    });

    this.input.keyboard?.on('keydown-DOWN', () => {
      if (this.controlsPanel?.visible) {
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

      this.menuOptions[this.selectedIndex]?.action();
    });

    this.input.keyboard?.on('keydown-ESC', () => {
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
        });
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.removeAllListeners();
    });
  }

  private refreshMenuSelection(): void {
    this.optionTexts.forEach((text, index) => {
      const isSelected = this.selectedIndex === index;
      text.setColor(isSelected ? '#fde047' : '#cbd5e1');
      text.setScale(isSelected ? 1.05 : 1);
    });
  }

  private toggleControlsPanel(visible: boolean): void {
    this.controlsPanel?.setVisible(visible);
  }

  private startNewRun(): void {
    this.registry.remove('checkpoint');
    this.scene.stop('UIScene');
    this.scene.start('GameScene', { skipLoad: true });
  }

  private continueRun(): void {
    this.scene.stop('UIScene');
    this.scene.start('GameScene');
  }

  private hasSavedProgress(): boolean {
    return Boolean(localStorage.getItem(LOCAL_PROGRESS_STORAGE_KEY));
  }
}
