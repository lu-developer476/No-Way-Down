import Phaser from 'phaser';
import { PartyHudMember } from './sceneShared';
import { controlManager } from '../input/ControlManager';
import { getWeaponCatalogEntry } from '../config/weaponCatalog';
import { getWeaponVisualRuntimeConfig } from '../config/weaponVisualRuntime';
import { visualTheme } from './visualTheme';

interface ProtagonistHud {
  container: Phaser.GameObjects.Container;
  nameText: Phaser.GameObjects.Text;
  hpFill: Phaser.GameObjects.Rectangle;
  hpValueText: Phaser.GameObjects.Text;
  activeWeaponIcon: Phaser.GameObjects.Image;
  secondaryWeaponIcon: Phaser.GameObjects.Image;
  activeWeaponText: Phaser.GameObjects.Text;
  secondaryWeaponText: Phaser.GameObjects.Text;
  ammoText: Phaser.GameObjects.Text;
  statusText: Phaser.GameObjects.Text;
}

type CombatHudStatusTone = 'normal' | 'reload' | 'switch' | 'empty';

export class UIScene extends Phaser.Scene {
  private protagonistHud?: ProtagonistHud;
  private previousProtagonistHud?: PartyHudMember;
  private combatStatusClearTimer?: Phaser.Time.TimerEvent;
  private zombieCountText?: Phaser.GameObjects.Text;
  private objectiveText?: Phaser.GameObjects.Text;
  private interactionText?: Phaser.GameObjects.Text;
  private interactionCard?: Phaser.GameObjects.Rectangle;
  private dialoguePanel?: Phaser.GameObjects.Container;
  private dialogueSpeakerText?: Phaser.GameObjects.Text;
  private dialogueBodyText?: Phaser.GameObjects.Text;
  private dialogueHintText?: Phaser.GameObjects.Text;
  private dialoguePortraitText?: Phaser.GameObjects.Text;
  private controlsLegendText?: Phaser.GameObjects.Text;

  constructor() {
    super('UIScene');
  }

  create(): void {
    this.cameras.main.setRoundPixels(true);
    this.createHudFrame();

    this.registry.events.on('changedata-interactionHint', this.handleInteractionHintChanged, this);
    this.registry.events.on('changedata-partyHud', this.handlePartyHudChanged, this);
    this.registry.events.on('changedata-zombiesRemaining', this.handleZombiesChanged, this);
    this.registry.events.on('changedata-currentObjective', this.handleObjectiveChanged, this);
    this.registry.events.on('changedata-isGamePaused', this.handlePauseStateChanged, this);
    this.registry.events.on('changedata-dialogueState', this.handleDialogueStateChanged, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-partyHud', this.handlePartyHudChanged, this);
      this.registry.events.off('changedata-zombiesRemaining', this.handleZombiesChanged, this);
      this.registry.events.off('changedata-currentObjective', this.handleObjectiveChanged, this);
      this.registry.events.off('changedata-isGamePaused', this.handlePauseStateChanged, this);
      this.registry.events.off('changedata-interactionHint', this.handleInteractionHintChanged, this);
      this.registry.events.off('changedata-dialogueState', this.handleDialogueStateChanged, this);
    });

    this.refreshFromRegistry();
  }

  private refreshFromRegistry(): void {
    this.handlePartyHudChanged(this.registry, this.registry.get('partyHud') ?? []);
    this.handleZombiesChanged(this.registry, this.registry.get('zombiesRemaining') ?? 0);
    this.handleObjectiveChanged(this.registry, this.registry.get('currentObjective') ?? '');
    this.handleInteractionHintChanged(this.registry, this.registry.get('interactionHint') ?? '');
    this.handlePauseStateChanged(this.registry, this.registry.get('isGamePaused') ?? false);
    this.handleDialogueStateChanged(this.registry, this.registry.get('dialogueState') ?? null);
  }

  private handlePartyHudChanged(_parent: Phaser.Data.DataManager, value: PartyHudMember[]): void {
    const members = Array.isArray(value) ? value : [];

    const protagonist = members.find((member) => member.role === 'protagonist') ?? members[0];
    if (!protagonist || !this.protagonistHud) {
      this.protagonistHud?.container.setVisible(false);
      return;
    }

    const hp = Phaser.Math.Clamp(Math.round(protagonist.health), 0, Math.max(1, protagonist.maxHealth));
    const maxHp = Math.max(1, Math.round(protagonist.maxHealth));
    const hpRatio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    const activeWeaponText = this.getWeaponDisplayLabel(protagonist.activeWeapon);
    const secondaryWeaponText = protagonist.secondaryWeapon
      ? this.getWeaponDisplayLabel(protagonist.secondaryWeapon)
      : 'Sin secundaria';
    const activeWeaponCatalog = getWeaponCatalogEntry(protagonist.activeWeapon);
    const isTrayShield = protagonist.activeWeapon === 'tray_shield';
    const specialStateText = isTrayShield
      ? 'ESCUDO ACTIVO'
      : activeWeaponCatalog.isMelee
        ? 'MODO MELEE'
        : '';
    const ammoText = this.getAmmoDisplayText(protagonist);
    const prev = this.previousProtagonistHud;
    const startedReload = !prev?.isReloading && Boolean(protagonist.isReloading);
    const switchedWeapon = prev?.activeWeapon !== undefined && prev.activeWeapon !== protagonist.activeWeapon;
    const justReachedEmpty = protagonist.usesAmmo
      && (protagonist.ammoCurrent ?? 0) <= 0
      && (protagonist.ammoReserve ?? 0) <= 0
      && ((prev?.ammoCurrent ?? 0) > 0 || (prev?.ammoReserve ?? 0) > 0);
    const shouldClearStatus = !protagonist.isReloading && !specialStateText;

    this.protagonistHud.nameText.setText(protagonist.name.toUpperCase());
    this.protagonistHud.hpFill
      .setSize(214 * hpRatio, 8)
      .setFillStyle(hpRatio <= 0.25 ? visualTheme.palette.uiHealthDanger : visualTheme.palette.uiHealth);
    this.protagonistHud.hpValueText.setText(`HP ${hp} / ${maxHp}`);
    this.refreshWeaponHudIcon(this.protagonistHud.activeWeaponIcon, protagonist.activeWeapon);
    this.refreshWeaponHudIcon(this.protagonistHud.secondaryWeaponIcon, protagonist.secondaryWeapon);
    this.protagonistHud.activeWeaponText.setText(`Activa: ${activeWeaponText}`);
    this.protagonistHud.secondaryWeaponText.setText(`Sec.: ${secondaryWeaponText}`);
    this.protagonistHud.ammoText.setText(ammoText);

    if (startedReload) {
      this.showCombatStatus('RECARGANDO...', 'reload', 850);
    } else if (switchedWeapon) {
      this.showCombatStatus(`ARMA: ${activeWeaponText}`, 'switch', 850);
    } else if (justReachedEmpty) {
      this.showCombatStatus('SIN MUNICIÓN', 'empty', 1000);
    } else if (protagonist.isReloading) {
      this.showCombatStatus('RECARGANDO...', 'reload', 220);
    } else if (specialStateText) {
      this.showCombatStatus(specialStateText, isTrayShield ? 'switch' : 'normal', 220);
    } else if (shouldClearStatus) {
      this.showCombatStatus('', 'normal', 0);
    }

    this.protagonistHud.container.setVisible(true);
    this.previousProtagonistHud = {
      ...protagonist
    };
  }

  private getWeaponDisplayLabel(weaponKey?: string): string {
    if (!weaponKey) {
      return '—';
    }

    return getWeaponCatalogEntry(weaponKey).displayName;
  }

  private getAmmoDisplayText(member: PartyHudMember): string {
    if (!member.usesAmmo) {
      return 'Munición: —';
    }

    const current = Math.max(0, member.ammoCurrent ?? 0);
    const reserve = Math.max(0, member.ammoReserve ?? 0);
    const ammoType = member.ammoType ? ` ${member.ammoType}` : '';
    return `Munición: ${current} / ${reserve}${ammoType}`;
  }

  private showCombatStatus(message: string, tone: CombatHudStatusTone, durationMs: number): void {
    if (!this.protagonistHud) {
      return;
    }

    this.combatStatusClearTimer?.remove(false);

    const statusText = this.protagonistHud.statusText;
    if (!message) {
      statusText.setText('').setVisible(false);
      return;
    }

    const colorByTone: Record<CombatHudStatusTone, string> = {
      normal: '#cbd5e1',
      reload: '#93c5fd',
      switch: '#fde68a',
      empty: '#fca5a5'
    };

    statusText
      .setColor(colorByTone[tone])
      .setText(message)
      .setVisible(true);

    if (durationMs > 0) {
      this.combatStatusClearTimer = this.time.delayedCall(durationMs, () => {
        statusText.setText('').setVisible(false);
      });
    }
  }

  private refreshWeaponHudIcon(icon: Phaser.GameObjects.Image, weaponKey?: string): void {
    const visual = getWeaponVisualRuntimeConfig(weaponKey, this);
    icon.setTexture(visual.hudTexture);
    icon.setScale(visual.hudScale);
  }

  private handleZombiesChanged(_parent: Phaser.Data.DataManager, value: number): void {
    this.zombieCountText?.setText(value > 0 ? `AMENAZAS  ${value}` : 'ÁREA LIMPIA');
  }

  private handleObjectiveChanged(_parent: Phaser.Data.DataManager, value: string): void {
    this.objectiveText?.setText(value || 'En espera');
  }

  private handleInteractionHintChanged(_parent: Phaser.Data.DataManager, value: string): void {
    const hint = value?.trim();
    this.interactionText
      ?.setText(hint || '')
      .setVisible(Boolean(hint));
    this.interactionCard?.setVisible(Boolean(hint));
  }

  private handlePauseStateChanged(_parent: Phaser.Data.DataManager, isPaused: boolean): void {
    this.protagonistHud?.container.setAlpha(isPaused ? 0.65 : 1);
  }

  private handleDialogueStateChanged(_parent: Phaser.Data.DataManager, value: { speaker: string; text: string; emotion?: string; portrait?: string; choices?: { text: string }[]; canSkip?: boolean; canAdvance?: boolean } | null): void {
    if (!value || !value.text) {
      this.dialoguePanel?.setVisible(false);
      return;
    }

    const subtitle = value.emotion ? `${value.text} (${value.emotion})` : value.text;
    const choicesText = value.choices?.length
      ? `\n\nOpciones:\n${value.choices.map((choice, index) => `${index + 1}. ${choice.text}`).join('\n')}`
      : '';

    this.dialogueSpeakerText?.setText(value.speaker || '...');
    this.dialoguePortraitText?.setText(value.portrait ? value.portrait : value.speaker || 'Narrador');
    this.dialogueBodyText?.setText(`${subtitle}${choicesText}`);
    this.dialogueHintText?.setText('SPACE: avanzar · X: saltar diálogo · 1-3: elegir');
    this.dialoguePanel?.setVisible(true);
  }

  private getControlsLegendText(): string {
    return `${controlManager.getMovementDisplayLabel().toUpperCase()} MOVER · ${controlManager.getDisplayLabel('jump').toUpperCase()} SALTAR · ${controlManager.getDisplayLabel('shoot').toUpperCase()} DISPARAR\n`
      + `${controlManager.getDisplayLabel('reload').toUpperCase()} RECARGAR · ${controlManager.getDisplayLabel('interact').toUpperCase()} INTERACTUAR · ${controlManager.getDisplayLabel('pause').toUpperCase()} PAUSA`;
  }

  private createHudFrame(): void {
    this.createScreenVignette();
    const pixelFont = '"Courier New", monospace';

    const protagonistPanel = this.add.rectangle(12, 12, 246, 112, visualTheme.palette.uiPanelFill, 0.94)
      .setOrigin(0).setStrokeStyle(2, visualTheme.palette.uiPanelBorder, 1).setScrollFactor(0);
    const protagonistHeader = this.add.rectangle(14, 14, 242, 22, visualTheme.palette.uiPanelRaised, 1)
      .setOrigin(0).setScrollFactor(0);

    const nameText = this.add.text(16, 14, '', {
      color: '#f8fafc',
      fontSize: '12px',
      fontFamily: pixelFont,
      fontStyle: 'bold'
    }).setScrollFactor(0);

    const hpBg = this.add.rectangle(16, 38, 214, 8, visualTheme.palette.uiPanelShadow, 0.95)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setStrokeStyle(1, 0x334155, 1);

    const hpFill = this.add.rectangle(16, 38, 0, 8, visualTheme.palette.uiHealth, 1)
      .setOrigin(0, 0)
      .setScrollFactor(0);

    const hpValueText = this.add.text(246, 27, '', {
      color: visualTheme.palette.uiTextSecondary,
      fontSize: '9px',
      fontFamily: pixelFont,
      fontStyle: 'bold'
    }).setOrigin(1, 0).setScrollFactor(0);

    const activeWeaponText = this.add.text(16, 44, '', {
      color: '#e2e8f0',
      fontSize: '11px',
      fontFamily: pixelFont
    }).setScrollFactor(0);

    const secondaryWeaponText = this.add.text(16, 58, '', {
      color: '#cbd5e1',
      fontSize: '11px',
      fontFamily: pixelFont
    }).setScrollFactor(0);

    const ammoText = this.add.text(16, 72, '', {
      color: Phaser.Display.Color.ValueToColor(visualTheme.palette.uiAmmo).rgba,
      fontSize: '11px',
      fontFamily: pixelFont,
      fontStyle: 'bold'
    }).setScrollFactor(0);

    const statusText = this.add.text(16, 86, '', {
      color: '#cbd5e1',
      fontSize: '10px',
      fontFamily: pixelFont,
      fontStyle: 'bold'
    }).setScrollFactor(0).setVisible(false);

    const activeWeaponIcon = this.add.image(164, 50, 'weapon-hud-missing')
      .setOrigin(0.5)
      .setScrollFactor(0);

    const secondaryWeaponIcon = this.add.image(164, 64, 'weapon-hud-missing')
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setAlpha(0.85);

    this.protagonistHud = {
      container: this.add.container(0, 0, [protagonistPanel, protagonistHeader, nameText, hpBg, hpFill, hpValueText, activeWeaponIcon, secondaryWeaponIcon, activeWeaponText, secondaryWeaponText, ammoText, statusText]).setDepth(20).setVisible(false),
      nameText,
      hpFill,
      hpValueText,
      activeWeaponIcon,
      secondaryWeaponIcon,
      activeWeaponText,
      secondaryWeaponText,
      ammoText,
      statusText
    };

    this.add.rectangle(this.scale.width - 12, 12, 154, 34, visualTheme.palette.uiPanelFill, 0.94)
      .setOrigin(1, 0).setStrokeStyle(2, visualTheme.palette.uiPanelBorder, 1).setScrollFactor(0).setDepth(19);
    this.zombieCountText = this.add.text(this.scale.width - 24, 22, '', {
      color: visualTheme.palette.uiTextPrimary,
      fontSize: '12px',
      fontFamily: pixelFont
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(20);

    this.add.rectangle(this.scale.width / 2, this.scale.height - 64, 640, 52, visualTheme.palette.uiObjectiveFill, 0.96)
      .setOrigin(0.5, 0).setStrokeStyle(2, visualTheme.palette.uiObjectiveBorder, 1).setScrollFactor(0).setDepth(9);
    this.add.text(this.scale.width / 2 - 306, this.scale.height - 57, 'MISIÓN', {
      color: visualTheme.palette.uiHighlight, fontSize: '9px', fontFamily: pixelFont, fontStyle: 'bold'
    }).setScrollFactor(0).setDepth(10);

    this.objectiveText = this.add.text(this.scale.width / 2, this.scale.height - 35, '', {
      color: visualTheme.palette.uiHighlight,
      fontSize: '14px',
      fontFamily: pixelFont,
      padding: { x: 18, y: 4 },
      wordWrap: { width: Math.min(this.scale.width - 72, 700) },
      align: 'center'
    })
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(9)
      .setAlpha(0.96);

    const dialogueWidth = Math.min(this.scale.width - 32, 780);
    const dialogueBg = this.add.rectangle(this.scale.width / 2, this.scale.height - 126, dialogueWidth, 152, visualTheme.palette.uiPanelFill, 0.97)
      .setStrokeStyle(3, visualTheme.palette.uiPanelBorder, 1)
      .setScrollFactor(0);
    const dialogueArtwork = this.textures.exists('menu_background')
      ? this.add.image(dialogueBg.x, dialogueBg.y, 'menu_background').setDisplaySize(dialogueWidth, 152).setAlpha(0.42).setScrollFactor(0)
      : this.add.rectangle(dialogueBg.x, dialogueBg.y, dialogueWidth, 152, 0x1b1522, 0.9).setScrollFactor(0);
    const dialogueTint = this.add.rectangle(dialogueBg.x, dialogueBg.y, dialogueWidth, 152, visualTheme.palette.uiPanelTint, 0.6).setScrollFactor(0);
    const dialogueBorder = this.add.rectangle(dialogueBg.x, dialogueBg.y, dialogueWidth, 152, 0x000000, 0).setStrokeStyle(3, visualTheme.palette.uiPanelFrameSoft, 1).setScrollFactor(0);

    const portraitBlock = this.add.rectangle(dialogueBg.x - dialogueBg.width / 2 + 58, dialogueBg.y, 108, 140, visualTheme.palette.uiPanelRaised, 0.95)
      .setStrokeStyle(1, visualTheme.palette.uiPanelBorderSoft, 1).setScrollFactor(0);

    this.dialogueSpeakerText = this.add.text(dialogueBg.x - dialogueBg.width / 2 + 128, dialogueBg.y - 56, '', {
      color: visualTheme.palette.uiTextSecondary,
      fontSize: '14px',
      fontFamily: pixelFont,
      fontStyle: 'bold'
    }).setOrigin(0, 0.5).setScrollFactor(0);


    this.dialoguePortraitText = this.add.text(dialogueBg.x - dialogueBg.width / 2 + 58, dialogueBg.y, '', {
      color: visualTheme.palette.uiTextMuted,
      fontSize: '10px',
      fontFamily: pixelFont
    }).setOrigin(0.5).setScrollFactor(0);

    this.dialogueBodyText = this.add.text(dialogueBg.x - dialogueBg.width / 2 + 128, dialogueBg.y - 34, '', {
      color: visualTheme.palette.uiTextPrimary,
      fontSize: '14px',
      fontFamily: pixelFont,
      wordWrap: { width: dialogueBg.width - 154 }
    }).setOrigin(0, 0).setScrollFactor(0);

    this.dialogueHintText = this.add.text(dialogueBg.x + dialogueBg.width / 2 - 16, dialogueBg.y + 58, '', {
      color: visualTheme.palette.uiTextMuted,
      fontSize: '9px',
      fontFamily: pixelFont
    }).setOrigin(1, 0.5).setScrollFactor(0);

    this.dialoguePanel = this.add.container(0, 0, [dialogueBg, dialogueArtwork, dialogueTint, dialogueBorder, portraitBlock, this.dialogueSpeakerText, this.dialoguePortraitText, this.dialogueBodyText, this.dialogueHintText])
      .setDepth(50)
      .setVisible(false);

    this.add.rectangle(this.scale.width - 12, 54, 440, 42, visualTheme.palette.uiPanelRaised, 0.84)
      .setOrigin(1, 0).setStrokeStyle(1, visualTheme.palette.uiPanelBorderSoft, 0.9).setScrollFactor(0).setDepth(11);
    this.controlsLegendText = this.add.text(this.scale.width - 22, 60, this.getControlsLegendText(), {
      color: visualTheme.palette.uiTextSecondary,
      fontSize: '9px',
      fontFamily: pixelFont,
      align: 'right',
      lineSpacing: 3,
      wordWrap: { width: 420 }
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(12).setAlpha(0.92);
    this.time.delayedCall(8000, () => this.controlsLegendText?.setAlpha(0.58));

    this.interactionCard = this.add.rectangle(this.scale.width / 2, this.scale.height - 72, 520, 34, visualTheme.palette.uiInteractionFill, 0.96)
      .setOrigin(0.5, 1).setStrokeStyle(2, visualTheme.palette.uiPanelAccent, 1).setScrollFactor(0).setDepth(20).setVisible(false);
    this.interactionText = this.add.text(this.scale.width / 2, this.scale.height - 89, '', {
      color: visualTheme.palette.uiTextPrimary,
      fontSize: '12px',
      fontFamily: pixelFont,
      padding: { x: 16, y: 6 },
      align: 'center'
    })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setVisible(false);
  }

  private createScreenVignette(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, 0, width, 36, visualTheme.palette.worldInk, 0.16).setOrigin(0.5, 0).setScrollFactor(0).setDepth(7);
    this.add.rectangle(width / 2, height, width, 36, visualTheme.palette.worldInk, 0.18).setOrigin(0.5, 1).setScrollFactor(0).setDepth(7);
    this.add.rectangle(0, height / 2, 28, height, visualTheme.palette.worldInk, 0.14).setOrigin(0, 0.5).setScrollFactor(0).setDepth(7);
    this.add.rectangle(width, height / 2, 28, height, visualTheme.palette.worldInk, 0.14).setOrigin(1, 0.5).setScrollFactor(0).setDepth(7);
  }
}
