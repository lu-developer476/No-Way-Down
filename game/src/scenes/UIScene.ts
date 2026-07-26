import Phaser from 'phaser';
import { PartyHudMember, PauseMenuView, TransitionView } from './sceneShared';
import { controlManager } from '../input/ControlManager';
import { getWeaponCatalogEntry } from '../config/weaponCatalog';
import { getWeaponVisualRuntimeConfig } from '../config/weaponVisualRuntime';
import { visualTheme } from './visualTheme';
import { calculateUiLayout, resolveDominantUiLayer, UI_LAYOUT } from './uiLayout';

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
interface PartyRosterRow {
  container: Phaser.GameObjects.Container;
  background: Phaser.GameObjects.Rectangle;
  nameText: Phaser.GameObjects.Text;
  hpBackground: Phaser.GameObjects.Rectangle;
  hpFill: Phaser.GameObjects.Rectangle;
}
type CombatHudStatusTone = 'normal' | 'reload' | 'switch' | 'empty';
type DialogueView = { speaker: string; text: string; emotion?: string; portrait?: string; choices?: { text: string }[] };

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
  private gameplayHudLayer?: Phaser.GameObjects.Container;
  private partyRosterContainer?: Phaser.GameObjects.Container;
  private readonly partyRosterRows: PartyRosterRow[] = [];
  private controlsCard?: Phaser.GameObjects.Container;
  private objectiveCard?: Phaser.GameObjects.Container;
  private threatCard?: Phaser.GameObjects.Container;
  private interactionContainer?: Phaser.GameObjects.Container;
  private pauseLayer?: Phaser.GameObjects.Container;
  private transitionLayer?: Phaser.GameObjects.Container;
  private pauseTitleText?: Phaser.GameObjects.Text;
  private pauseDetailsText?: Phaser.GameObjects.Text;
  private pauseOptionTexts: Phaser.GameObjects.Text[] = [];
  private pauseOptionBackgrounds: Phaser.GameObjects.Rectangle[] = [];
  private pauseHintText?: Phaser.GameObjects.Text;
  private transitionLabelText?: Phaser.GameObjects.Text;
  private transitionMessageText?: Phaser.GameObjects.Text;
  private currentPauseMenuView?: PauseMenuView;
  private currentTransitionView?: TransitionView;
  private hasVisibleDialogue = false;
  private fatalLayer?: Phaser.GameObjects.Container;
  private fatalTitleText?: Phaser.GameObjects.Text;
  private fatalBodyText?: Phaser.GameObjects.Text;
  private currentFatalError?: unknown;
  private controlsFadeTimer?: Phaser.Time.TimerEvent;
  private createdAtWidth: number = UI_LAYOUT.logicalWidth;
  private createdAtHeight: number = UI_LAYOUT.logicalHeight;

  constructor() { super('UIScene'); }

  create(): void {
    this.cameras.main.setRoundPixels(true);
    this.createdAtWidth = this.scale.width;
    this.createdAtHeight = this.scale.height;
    this.createHudFrame();
    const events = this.registry.events;
    events.on('changedata-interactionHint', this.handleInteractionHintChanged, this);
    events.on('changedata-partyHud', this.handlePartyHudChanged, this);
    events.on('changedata-zombiesRemaining', this.handleZombiesChanged, this);
    events.on('changedata-currentObjective', this.handleObjectiveChanged, this);
    events.on('changedata-dialogueState', this.handleDialogueStateChanged, this);
    events.on('changedata-pauseMenuView', this.handlePauseMenuViewChanged, this);
    events.on('changedata-transitionView', this.handleTransitionViewChanged, this);
    events.on('changedata-campaignLoadError', this.handleFatalErrorChanged, this);
    events.on('changedata-campaignDevelopmentError', this.handleFatalErrorChanged, this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      events.off('changedata-interactionHint', this.handleInteractionHintChanged, this);
      events.off('changedata-partyHud', this.handlePartyHudChanged, this);
      events.off('changedata-zombiesRemaining', this.handleZombiesChanged, this);
      events.off('changedata-currentObjective', this.handleObjectiveChanged, this);
      events.off('changedata-dialogueState', this.handleDialogueStateChanged, this);
      events.off('changedata-pauseMenuView', this.handlePauseMenuViewChanged, this);
      events.off('changedata-transitionView', this.handleTransitionViewChanged, this);
      events.off('changedata-campaignLoadError', this.handleFatalErrorChanged, this);
      events.off('changedata-campaignDevelopmentError', this.handleFatalErrorChanged, this);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      this.combatStatusClearTimer?.remove(false);
      this.controlsFadeTimer?.remove(false);
      this.combatStatusClearTimer = undefined;
      this.controlsFadeTimer = undefined;
      this.pauseOptionTexts = [];
      this.pauseOptionBackgrounds = [];
      this.partyRosterRows.length = 0;
      this.clearObjectReferences();
    });
    this.refreshFromRegistry();
    this.handleResize();
  }

  private refreshFromRegistry(): void {
    this.handlePartyHudChanged(this.registry, this.registry.get('partyHud') ?? []);
    this.handleZombiesChanged(this.registry, this.registry.get('zombiesRemaining') ?? 0);
    this.handleObjectiveChanged(this.registry, this.registry.get('currentObjective') ?? '');
    this.handleInteractionHintChanged(this.registry, this.registry.get('interactionHint') ?? '');
    this.handleDialogueStateChanged(this.registry, this.registry.get('dialogueState') ?? null);
    this.handlePauseMenuViewChanged(this.registry, this.registry.get('pauseMenuView') ?? null);
    this.handleTransitionViewChanged(this.registry, this.registry.get('transitionView') ?? null);
    this.handleFatalErrorChanged(this.registry, this.registry.get('campaignDevelopmentError') ?? this.registry.get('campaignLoadError') ?? null);
  }

  private handleResize(): void {
    const layout = calculateUiLayout(this.scale.width, this.scale.height);
    const dx = layout.width - this.createdAtWidth;
    const dy = layout.height - this.createdAtHeight;
    this.threatCard?.setPosition(dx, 0);
    this.controlsCard?.setPosition(dx, 0);
    this.objectiveCard?.setPosition(dx / 2, dy);
    this.interactionContainer?.setPosition(dx / 2, dy);
    this.dialoguePanel?.setPosition(dx / 2, dy);
    this.pauseLayer?.setPosition(dx / 2, dy / 2);
    this.transitionLayer?.setPosition(dx / 2, dy / 2);
    this.fatalLayer?.setPosition(dx / 2, dy / 2);
    this.resizeModalOverlay(this.pauseLayer, layout.width, layout.height);
    this.resizeModalOverlay(this.transitionLayer, layout.width, layout.height);
    this.resizeModalOverlay(this.fatalLayer, layout.width, layout.height);
    this.cameras.main.setViewport(0, 0, layout.width, layout.height);
  }

  private resizeModalOverlay(layer: Phaser.GameObjects.Container | undefined, width: number, height: number): void {
    const overlay = layer?.getAt(0);
    if (overlay instanceof Phaser.GameObjects.Rectangle) overlay.setSize(width, height);
  }

  private clearObjectReferences(): void {
    this.protagonistHud = undefined; this.previousProtagonistHud = undefined;
    this.zombieCountText = undefined; this.objectiveText = undefined; this.interactionText = undefined;
    this.interactionCard = undefined; this.dialoguePanel = undefined; this.gameplayHudLayer = undefined;
    this.partyRosterContainer = undefined; this.controlsCard = undefined; this.objectiveCard = undefined;
    this.threatCard = undefined; this.interactionContainer = undefined; this.pauseLayer = undefined;
    this.transitionLayer = undefined; this.fatalLayer = undefined;
  }

  private handlePartyHudChanged(_parent: Phaser.Data.DataManager, value: PartyHudMember[]): void {
    const members = Array.isArray(value) ? value : [];
    const protagonist = members.find((member) => member.role === 'protagonist') ?? members[0];
    const companions = protagonist
      ? members.filter((member) => member.id !== protagonist.id).slice(0, 8)
      : members.slice(0, 8);
    if (!protagonist || !this.protagonistHud) {
      this.protagonistHud?.container.setVisible(false);
      this.previousProtagonistHud = undefined;
      this.refreshPartyRoster(companions);
      return;
    }
    const maxHp = Math.max(1, Math.round(protagonist.maxHealth));
    const hp = Phaser.Math.Clamp(Math.round(protagonist.health), 0, maxHp);
    const ratio = Phaser.Math.Clamp(hp / maxHp, 0, 1);
    const active = this.getWeaponDisplayLabel(protagonist.activeWeapon);
    const secondary = protagonist.secondaryWeapon ? this.getWeaponDisplayLabel(protagonist.secondaryWeapon) : 'Sin secundaria';
    const catalog = getWeaponCatalogEntry(protagonist.activeWeapon);
    const shield = protagonist.activeWeapon === 'tray_shield';
    const special = shield ? 'ESCUDO ACTIVO' : catalog.isMelee ? 'MODO MELEE' : '';
    const prev = this.previousProtagonistHud;
    const empty = protagonist.usesAmmo && (protagonist.ammoCurrent ?? 0) <= 0 && (protagonist.ammoReserve ?? 0) <= 0
      && ((prev?.ammoCurrent ?? 0) > 0 || (prev?.ammoReserve ?? 0) > 0);
    this.protagonistHud.nameText.setText(protagonist.name.toUpperCase());
    this.protagonistHud.hpFill.setSize(214 * ratio, 8).setFillStyle(ratio <= .25 ? visualTheme.palette.uiHealthDanger : visualTheme.palette.uiHealth);
    this.protagonistHud.hpValueText.setText(`HP ${hp} / ${maxHp}`);
    this.refreshWeaponHudIcon(this.protagonistHud.activeWeaponIcon, protagonist.activeWeapon);
    this.refreshWeaponHudIcon(this.protagonistHud.secondaryWeaponIcon, protagonist.secondaryWeapon);
    this.protagonistHud.activeWeaponText.setText(`Activa: ${active}`);
    this.protagonistHud.secondaryWeaponText.setText(`Sec.: ${secondary}`);
    this.protagonistHud.ammoText.setText(this.getAmmoDisplayText(protagonist));
    if (!prev?.isReloading && protagonist.isReloading) this.showCombatStatus('RECARGANDO...', 'reload', 850);
    else if (prev?.activeWeapon !== undefined && prev.activeWeapon !== protagonist.activeWeapon) this.showCombatStatus(`ARMA: ${active}`, 'switch', 850);
    else if (empty) this.showCombatStatus('SIN MUNICIÓN', 'empty', 1000);
    else if (protagonist.isReloading) this.showCombatStatus('RECARGANDO...', 'reload', 220);
    else if (special) this.showCombatStatus(special, shield ? 'switch' : 'normal', 220);
    else this.showCombatStatus('', 'normal', 0);
    this.protagonistHud.container.setVisible(Boolean(this.gameplayHudLayer?.visible));
    this.previousProtagonistHud = { ...protagonist };
    this.refreshPartyRoster(companions);
  }

  private refreshPartyRoster(members: PartyHudMember[]): void {
    this.partyRosterRows.forEach((row, index) => {
      const member = members[index];
      if (!member) {
        row.container.setVisible(false);
        return;
      }

      const maxHealth = Math.max(1, member.maxHealth);
      const health = Phaser.Math.Clamp(member.health, 0, maxHealth);
      const ratio = Phaser.Math.Clamp(health / maxHealth, 0, 1);
      const color = ratio <= 0.25
        ? visualTheme.palette.uiHealthDanger
        : ratio <= 0.5
          ? visualTheme.palette.uiAmmo
          : visualTheme.palette.uiHealth;
      row.container.setVisible(true).setAlpha(health > 0 ? 1 : 0.45);
      row.nameText.setText(member.name.toUpperCase());
      row.hpFill.setSize(102 * ratio, 3).setFillStyle(color);
    });
    this.partyRosterContainer?.setVisible(members.length > 0);
  }

  private getWeaponDisplayLabel(key?: string): string { return key ? getWeaponCatalogEntry(key).displayName : '—'; }
  private getAmmoDisplayText(member: PartyHudMember): string {
    if (!member.usesAmmo) return 'Munición: —';
    return `Munición: ${Math.max(0, member.ammoCurrent ?? 0)} / ${Math.max(0, member.ammoReserve ?? 0)}${member.ammoType ? ` ${member.ammoType}` : ''}`;
  }
  private refreshWeaponHudIcon(icon: Phaser.GameObjects.Image, key?: string): void {
    const visual = getWeaponVisualRuntimeConfig(key, this); icon.setTexture(visual.hudTexture).setScale(visual.hudScale);
  }
  private showCombatStatus(message: string, tone: CombatHudStatusTone, duration: number): void {
    if (!this.protagonistHud) return;
    this.combatStatusClearTimer?.remove(false);
    const text = this.protagonistHud.statusText;
    if (!message) { text.setText('').setVisible(false); return; }
    text.setColor({ normal: '#cbd5e1', reload: '#93c5fd', switch: '#fde68a', empty: '#fca5a5' }[tone]).setText(message).setVisible(true);
    if (duration > 0) this.combatStatusClearTimer = this.time.delayedCall(duration, () => text.setText('').setVisible(false));
  }

  private handleZombiesChanged(_p: Phaser.Data.DataManager, value: number): void { this.zombieCountText?.setText(value > 0 ? `AMENAZAS  ${value}` : 'ÁREA LIMPIA'); }
  private handleObjectiveChanged(_p: Phaser.Data.DataManager, value: string): void { this.objectiveText?.setText(value || 'En espera'); }
  private handleInteractionHintChanged(_p: Phaser.Data.DataManager, value: string): void {
    const hint = value?.trim();
    this.interactionText?.setText(hint || '');
    if (hint && this.interactionText && this.interactionCard) {
      const targetWidth = Phaser.Math.Clamp(this.interactionText.width + 40, 220, 500);
      this.interactionCard.setSize(targetWidth, Math.max(UI_LAYOUT.interactionHeight, this.interactionText.height + 14));
    }
    this.interactionContainer?.setVisible(Boolean(hint) && Boolean(this.gameplayHudLayer?.visible));
  }
  private handleDialogueStateChanged(_p: Phaser.Data.DataManager, value: DialogueView | null): void {
    this.hasVisibleDialogue = Boolean(value?.text);
    if (value?.text) {
      const choices = value.choices?.length ? `\n${value.choices.map((choice, i) => `${i + 1}. ${choice.text}`).join('\n')}` : '';
      this.dialogueSpeakerText?.setText(value.speaker || '...');
      this.dialoguePortraitText?.setText(value.portrait || value.speaker || 'Narrador');
      this.dialogueBodyText?.setFontSize(value.choices?.length ? 10 : 11)
        .setText(`${value.text}${value.emotion ? ` (${value.emotion})` : ''}${choices}`);
      while (this.dialogueBodyText && this.dialogueBodyText.height > 104 && Number.parseInt(String(this.dialogueBodyText.style.fontSize), 10) > 8) {
        this.dialogueBodyText.setFontSize(Number.parseInt(String(this.dialogueBodyText.style.fontSize), 10) - 1);
      }
    }
    this.refreshUiVisibility();
  }

  private handlePauseMenuViewChanged(_p: Phaser.Data.DataManager, value: PauseMenuView | null): void {
    if (!value || typeof value !== 'object' || !Array.isArray(value.options)) this.currentPauseMenuView = undefined;
    else {
      this.currentPauseMenuView = value;
      this.pauseTitleText?.setText(value.title);
      this.pauseDetailsText?.setText(value.details).setVisible(Boolean(value.details));
      this.pauseHintText?.setText(value.hint);
      this.pauseOptionTexts.forEach((text, i) => {
        const visible = i < value.options.length;
        const selected = i === value.selectedIndex;
        text.setText(value.options[i] ?? '').setVisible(visible).setColor(selected ? visualTheme.palette.uiHighlight : visualTheme.palette.uiTextSecondary);
        this.pauseOptionBackgrounds[i].setVisible(visible).setFillStyle(selected ? visualTheme.palette.uiPanelRaised : visualTheme.palette.uiPanelFill, selected ? 1 : .18)
          .setStrokeStyle(selected ? 1 : 0, visualTheme.palette.uiPanelAccent, selected ? 1 : 0);
      });
    }
    this.refreshUiVisibility();
  }

  private handleTransitionViewChanged(_p: Phaser.Data.DataManager, value: TransitionView | null): void {
    this.currentTransitionView = value && typeof value === 'object' ? value : undefined;
    const danger = value?.tone === 'danger';
    this.transitionLabelText?.setText(danger ? 'DERROTA' : 'TRANSICIÓN').setColor(danger ? visualTheme.palette.uiDanger : visualTheme.palette.uiAccent);
    this.transitionMessageText?.setText(value?.message ?? '').setColor(danger ? visualTheme.palette.uiDanger : visualTheme.palette.uiTextPrimary);
    this.refreshUiVisibility();
  }

  private handleFatalErrorChanged(_p: Phaser.Data.DataManager, value: unknown): void {
    this.currentFatalError = value || this.registry.get('campaignDevelopmentError') || this.registry.get('campaignLoadError');
    if (this.currentFatalError && typeof this.currentFatalError === 'object') {
      const error = this.currentFatalError as Record<string, unknown>;
      const node = error.nodeId ?? 'desconocido';
      const asset = error.assetPath ?? error.levelConfigPath ?? 'sin ruta';
      const reason = error.reason ?? 'La campaña fue detenida para evitar un estado inválido.';
      this.fatalTitleText?.setText('ERROR DE CAMPAÑA');
      this.fatalBodyText?.setText(`No se pudo continuar de forma segura.\n\nNodo: ${String(node)}\nRecurso: ${String(asset)}\n\n${String(reason)}`);
    }
    this.refreshUiVisibility();
  }

  private refreshUiVisibility(): void {
    const dominant = resolveDominantUiLayer({
      fatal: Boolean(this.currentFatalError),
      transition: Boolean(this.currentTransitionView?.visible),
      pause: Boolean(this.currentPauseMenuView?.visible),
      dialogue: this.hasVisibleDialogue
    });
    const fatalVisible = dominant === 'fatal';
    const transitionVisible = dominant === 'transition';
    const pauseVisible = dominant === 'pause';
    const dialogueVisible = dominant === 'dialogue';
    const gameplayVisible = dominant === 'gameplay';
    this.fatalLayer?.setVisible(fatalVisible);
    this.transitionLayer?.setVisible(transitionVisible);
    this.pauseLayer?.setVisible(pauseVisible);
    this.dialoguePanel?.setVisible(dialogueVisible);
    this.gameplayHudLayer?.setVisible(gameplayVisible);
    this.controlsCard?.setVisible(gameplayVisible);
    this.threatCard?.setVisible(gameplayVisible);
    this.objectiveCard?.setVisible(gameplayVisible);
    this.interactionContainer?.setVisible(gameplayVisible && Boolean(this.interactionText?.text));
    this.protagonistHud?.container.setVisible(gameplayVisible && Boolean(this.previousProtagonistHud));
  }

  private getControlsLegendText(): string {
    return `${controlManager.getMovementDisplayLabel().toUpperCase()} MOVER · ${controlManager.getDisplayLabel('jump').toUpperCase()} SALTAR · ${controlManager.getDisplayLabel('shoot').toUpperCase()} DISPARAR\n${controlManager.getDisplayLabel('reload').toUpperCase()} RECARGAR · ${controlManager.getDisplayLabel('interact').toUpperCase()} INTERACTUAR · ${controlManager.getDisplayLabel('pause').toUpperCase()} PAUSA`;
  }

  private createHudFrame(): void {
    this.createScreenVignette();
    const font = '"Courier New", monospace';
    this.gameplayHudLayer = this.add.container(0, 0).setDepth(20);
    const protagonistObjects: Phaser.GameObjects.GameObject[] = [];
    const addP = <T extends Phaser.GameObjects.GameObject>(o: T): T => { protagonistObjects.push(o); return o; };
    addP(this.add.rectangle(12, 12, 246, 112, visualTheme.palette.uiPanelFill, .94).setOrigin(0).setStrokeStyle(2, visualTheme.palette.uiPanelBorder));
    addP(this.add.rectangle(14, 14, 242, 22, visualTheme.palette.uiPanelRaised).setOrigin(0));
    const nameText = addP(this.add.text(16, 14, '', { color: '#f8fafc', fontSize: '12px', fontFamily: font, fontStyle: 'bold' }));
    addP(this.add.rectangle(16, 38, 214, 8, visualTheme.palette.uiPanelShadow, .95).setOrigin(0).setStrokeStyle(1, 0x334155));
    const hpFill = addP(this.add.rectangle(16, 38, 0, 8, visualTheme.palette.uiHealth).setOrigin(0));
    const hpValueText = addP(this.add.text(246, 27, '', { color: visualTheme.palette.uiTextSecondary, fontSize: '9px', fontFamily: font, fontStyle: 'bold' }).setOrigin(1, 0));
    const activeWeaponText = addP(this.add.text(16, 44, '', { color: '#e2e8f0', fontSize: '11px', fontFamily: font }));
    const secondaryWeaponText = addP(this.add.text(16, 58, '', { color: '#cbd5e1', fontSize: '11px', fontFamily: font }));
    const ammoText = addP(this.add.text(16, 72, '', { color: Phaser.Display.Color.ValueToColor(visualTheme.palette.uiAmmo).rgba, fontSize: '11px', fontFamily: font, fontStyle: 'bold' }));
    const statusText = addP(this.add.text(16, 86, '', { color: '#cbd5e1', fontSize: '10px', fontFamily: font, fontStyle: 'bold' }).setVisible(false));
    const activeWeaponIcon = addP(this.add.image(164, 50, 'weapon-hud-missing'));
    const secondaryWeaponIcon = addP(this.add.image(164, 64, 'weapon-hud-missing').setAlpha(.85));
    const protagonistContainer = this.add.container(0, 0, protagonistObjects).setVisible(false);
    this.gameplayHudLayer.add(protagonistContainer);
    this.protagonistHud = { container: protagonistContainer, nameText, hpFill, hpValueText, activeWeaponIcon, secondaryWeaponIcon, activeWeaponText, secondaryWeaponText, ammoText, statusText };
    this.createPartyRoster(font);

    const threatBg = this.add.rectangle(this.scale.width - 12, 12, 154, 34, visualTheme.palette.uiPanelFill, .94).setOrigin(1, 0).setStrokeStyle(2, visualTheme.palette.uiPanelBorder);
    this.zombieCountText = this.add.text(this.scale.width - 24, 22, '', { color: visualTheme.palette.uiTextPrimary, fontSize: '12px', fontFamily: font }).setOrigin(1, 0);
    this.threatCard = this.add.container(0, 0, [threatBg, this.zombieCountText]); this.gameplayHudLayer.add(this.threatCard);

    const controlsBg = this.add.rectangle(this.scale.width - 12, 54, 370, 38, visualTheme.palette.uiPanelRaised, .84).setOrigin(1, 0).setStrokeStyle(1, visualTheme.palette.uiPanelBorderSoft, .9);
    this.controlsLegendText = this.add.text(this.scale.width - 22, 59, this.getControlsLegendText(), { color: visualTheme.palette.uiTextSecondary, fontSize: '8px', fontFamily: font, align: 'right', lineSpacing: 2, wordWrap: { width: 350 } }).setOrigin(1, 0);
    this.controlsCard = this.add.container(0, 0, [controlsBg, this.controlsLegendText]); this.gameplayHudLayer.add(this.controlsCard);
    this.controlsFadeTimer = this.time.delayedCall(8000, () => this.controlsLegendText?.setAlpha(.58));

    const objectiveBg = this.add.rectangle(this.scale.width / 2, this.scale.height - 58, 580, 46, visualTheme.palette.uiObjectiveFill, .96).setOrigin(.5, 0).setStrokeStyle(2, visualTheme.palette.uiObjectiveBorder);
    const objectiveLabel = this.add.text(this.scale.width / 2 - 276, this.scale.height - 53, 'MISIÓN', { color: visualTheme.palette.uiHighlight, fontSize: '8px', fontFamily: font, fontStyle: 'bold' });
    this.objectiveText = this.add.text(this.scale.width / 2, this.scale.height - 25, '', { color: visualTheme.palette.uiHighlight, fontSize: '12px', fontFamily: font, wordWrap: { width: 540 }, align: 'center' }).setOrigin(.5, 1);
    this.objectiveCard = this.add.container(0, 0, [objectiveBg, objectiveLabel, this.objectiveText]); this.gameplayHudLayer.add(this.objectiveCard);

    this.interactionCard = this.add.rectangle(this.scale.width / 2, this.scale.height - 66, 500, 30, visualTheme.palette.uiInteractionFill, .96).setOrigin(.5, 1).setStrokeStyle(2, visualTheme.palette.uiPanelAccent);
    this.interactionText = this.add.text(this.scale.width / 2, this.scale.height - 81, '', { color: visualTheme.palette.uiTextPrimary, fontSize: '10px', fontFamily: font, align: 'center', wordWrap: { width: 500, useAdvancedWrap: true } }).setOrigin(.5);
    this.interactionContainer = this.add.container(0, 0, [this.interactionCard, this.interactionText]).setVisible(false); this.gameplayHudLayer.add(this.interactionContainer);

    const dialogueWidth = UI_LAYOUT.dialogueMaxWidth, dialogueHeight = UI_LAYOUT.dialogueHeight;
    const dialogueY = this.scale.height - UI_LAYOUT.margin - dialogueHeight / 2;
    const left = this.scale.width / 2 - dialogueWidth / 2;
    const dialogueBg = this.add.rectangle(this.scale.width / 2, dialogueY, dialogueWidth, dialogueHeight, visualTheme.palette.uiPanelFill, .97).setStrokeStyle(2, visualTheme.palette.uiPanelBorder);
    const portrait = this.add.rectangle(left + 50, dialogueY, 88, dialogueHeight - 14, visualTheme.palette.uiPanelRaised, .98).setStrokeStyle(1, visualTheme.palette.uiPanelBorderSoft);
    this.dialoguePortraitText = this.add.text(left + 50, dialogueY, '', { color: visualTheme.palette.uiTextMuted, fontSize: '9px', fontFamily: font, align: 'center', wordWrap: { width: 72, useAdvancedWrap: true } }).setOrigin(.5);
    this.dialogueSpeakerText = this.add.text(left + 104, dialogueY - 66, '', { color: visualTheme.palette.uiAccent, fontSize: '12px', fontFamily: font, fontStyle: 'bold' });
    this.dialogueBodyText = this.add.text(left + 104, dialogueY - 47, '', { color: visualTheme.palette.uiTextPrimary, fontSize: '11px', fontFamily: font, lineSpacing: 2, wordWrap: { width: 680, useAdvancedWrap: true } });
    this.dialogueHintText = this.add.text(left + dialogueWidth - 12, dialogueY + 64, 'SPACE avanzar · X saltar · 1-3 elegir', { color: visualTheme.palette.uiTextMuted, fontSize: '8px', fontFamily: font }).setOrigin(1, .5);
    this.dialoguePanel = this.add.container(0, 0, [dialogueBg, portrait, this.dialoguePortraitText, this.dialogueSpeakerText, this.dialogueBodyText, this.dialogueHintText]).setDepth(60).setVisible(false);

    this.createPauseLayer(font);
    this.createTransitionLayer(font);
    this.createFatalLayer(font);
  }

  private createPartyRoster(fontFamily: string): void {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const panel = this.add.rectangle(12, 130, 246, 112, visualTheme.palette.uiPanelFill, 0.92)
      .setOrigin(0)
      .setStrokeStyle(1, visualTheme.palette.uiPanelBorderSoft);
    const header = this.add.rectangle(14, 132, 242, 17, visualTheme.palette.uiPanelRaised).setOrigin(0);
    const title = this.add.text(20, 135, 'GRUPO', {
      color: visualTheme.palette.uiTextSecondary,
      fontSize: '8px',
      fontFamily,
      fontStyle: 'bold'
    });
    objects.push(panel, header, title);

    for (let index = 0; index < 8; index += 1) {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const background = this.add.rectangle(0, 0, 112, 20, visualTheme.palette.uiPanelRaised, 0.5)
        .setOrigin(0)
        .setStrokeStyle(1, visualTheme.palette.uiPanelBorderSoft, 0.35);
      const nameText = this.add.text(5, 2, '', {
        color: visualTheme.palette.uiTextPrimary,
        fontSize: '8px',
        fontFamily,
        fontStyle: 'bold'
      });
      const hpBackground = this.add.rectangle(5, 15, 102, 3, visualTheme.palette.uiPanelShadow, 0.95).setOrigin(0);
      const hpFill = this.add.rectangle(5, 15, 102, 3, visualTheme.palette.uiHealth).setOrigin(0);
      const container = this.add.container(18 + column * 120, 152 + row * 22, [background, nameText, hpBackground, hpFill])
        .setVisible(false);
      this.partyRosterRows.push({ container, background, nameText, hpBackground, hpFill });
      objects.push(container);
    }

    this.partyRosterContainer = this.add.container(0, 0, objects).setVisible(false);
    this.gameplayHudLayer?.add(this.partyRosterContainer);
  }

  private createPauseLayer(font: string): void {
    const { width, height } = this.scale;
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, visualTheme.palette.uiPanelShadow, .88);
    const panel = this.add.rectangle(width / 2, height / 2, 430, 318, visualTheme.palette.uiPanelFill, 1).setStrokeStyle(2, visualTheme.palette.uiPanelBorder);
    const inner = this.add.rectangle(width / 2, height / 2, 422, 310, 0x000000, 0).setStrokeStyle(1, visualTheme.palette.uiPanelBorderSoft);
    this.pauseTitleText = this.add.text(width / 2, height / 2 - 128, 'PAUSA', { color: visualTheme.palette.uiTextPrimary, fontSize: '25px', fontFamily: font, fontStyle: 'bold' }).setOrigin(.5);
    this.pauseDetailsText = this.add.text(width / 2, height / 2 - 82, '', { color: visualTheme.palette.uiTextSecondary, fontSize: '9px', fontFamily: font, align: 'center', lineSpacing: 2, wordWrap: { width: 360, useAdvancedWrap: true } }).setOrigin(.5, 0).setVisible(false);
    const objects: Phaser.GameObjects.GameObject[] = [overlay, panel, inner, this.pauseTitleText, this.pauseDetailsText];
    for (let i = 0; i < 5; i += 1) {
      const y = height / 2 - 34 + i * 40;
      const bg = this.add.rectangle(width / 2, y, 344, 34, visualTheme.palette.uiPanelFill, .18);
      const text = this.add.text(width / 2, y, '', { color: visualTheme.palette.uiTextSecondary, fontSize: '15px', fontFamily: font }).setOrigin(.5);
      this.pauseOptionBackgrounds.push(bg); this.pauseOptionTexts.push(text); objects.push(bg, text);
    }
    this.pauseHintText = this.add.text(width / 2, height / 2 + 142, '', { color: visualTheme.palette.uiTextMuted, fontSize: '9px', fontFamily: font, align: 'center', wordWrap: { width: 380, useAdvancedWrap: true } }).setOrigin(.5);
    objects.push(this.pauseHintText);
    this.pauseLayer = this.add.container(0, 0, objects).setDepth(70).setScrollFactor(0).setVisible(false);
  }

  private createTransitionLayer(font: string): void {
    const { width, height } = this.scale;
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, visualTheme.palette.uiPanelShadow, .9);
    const card = this.add.rectangle(width / 2, height / 2, UI_LAYOUT.transitionMaxWidth, UI_LAYOUT.transitionHeight, visualTheme.palette.uiPanelFill, 1).setStrokeStyle(2, visualTheme.palette.uiPanelBorder);
    this.transitionLabelText = this.add.text(width / 2, height / 2 - 68, 'TRANSICIÓN', { color: visualTheme.palette.uiAccent, fontSize: '9px', fontFamily: font, fontStyle: 'bold' }).setOrigin(.5);
    this.transitionMessageText = this.add.text(width / 2, height / 2 + 4, '', { color: visualTheme.palette.uiTextPrimary, fontSize: '14px', fontFamily: font, align: 'center', lineSpacing: 4, wordWrap: { width: 560, useAdvancedWrap: true } }).setOrigin(.5);
    this.transitionLayer = this.add.container(0, 0, [overlay, card, this.transitionLabelText, this.transitionMessageText]).setDepth(80).setScrollFactor(0).setVisible(false);
  }

  private createFatalLayer(font: string): void {
    const { width, height } = this.scale;
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x09070b, .98);
    const cardWidth = Math.min(UI_LAYOUT.fatalMaxWidth, width - UI_LAYOUT.margin * 4);
    const card = this.add.rectangle(width / 2, height / 2, cardWidth, UI_LAYOUT.fatalHeight, visualTheme.palette.uiPanelFill, 1)
      .setStrokeStyle(2, Phaser.Display.Color.ValueToColor(visualTheme.palette.uiDanger).color);
    this.fatalTitleText = this.add.text(width / 2, height / 2 - 112, 'ERROR DE CAMPAÑA', {
      color: visualTheme.palette.uiDanger, fontSize: '18px', fontFamily: font, fontStyle: 'bold'
    }).setOrigin(.5);
    this.fatalBodyText = this.add.text(width / 2, height / 2 - 72, '', {
      color: visualTheme.palette.uiTextPrimary, fontSize: '12px', fontFamily: font, align: 'center',
      lineSpacing: 4, wordWrap: { width: cardWidth - 56, useAdvancedWrap: true }
    }).setOrigin(.5, 0);
    const hint = this.add.text(width / 2, height / 2 + 116, 'La campaña quedó detenida. Volvé al menú o recargá el juego.', {
      color: visualTheme.palette.uiTextMuted, fontSize: '9px', fontFamily: font, align: 'center',
      wordWrap: { width: cardWidth - 40, useAdvancedWrap: true }
    }).setOrigin(.5);
    this.fatalLayer = this.add.container(0, 0, [overlay, card, this.fatalTitleText, this.fatalBodyText, hint])
      .setDepth(100).setScrollFactor(0).setVisible(false);
  }

  private createScreenVignette(): void {
    const { width, height } = this.scale;
    this.add.rectangle(width / 2, 0, width, 36, visualTheme.palette.worldInk, .16).setOrigin(.5, 0).setScrollFactor(0).setDepth(7);
    this.add.rectangle(width / 2, height, width, 36, visualTheme.palette.worldInk, .18).setOrigin(.5, 1).setScrollFactor(0).setDepth(7);
    this.add.rectangle(0, height / 2, 28, height, visualTheme.palette.worldInk, .14).setOrigin(0, .5).setScrollFactor(0).setDepth(7);
    this.add.rectangle(width, height / 2, 28, height, visualTheme.palette.worldInk, .14).setOrigin(1, .5).setScrollFactor(0).setDepth(7);
  }
}
