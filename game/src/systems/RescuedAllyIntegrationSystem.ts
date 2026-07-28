import { PlayerSlot } from '../config/localMultiplayer';

export type AllyControlMode = 'human' | 'ai' | 'unassigned';

export interface RescuedAllyIdentityConfig {
  id: string;
  codename: string;
  displayName: string;
  tint?: number;
  followOffsetX?: number;
}

export interface RescuedAllyWeaponConfig {
  id: string;
  name: string;
  ammo: number;
}

export interface RescuedAllyControlConfig {
  preferredHumanSlots: PlayerSlot[];
  allowAnyHumanSlot: boolean;
  allowAiFallback: boolean;
}

export interface RescuedAllyHudConfig {
  groupStatusRegistryKey: string;
  allyStatusRegistryKey: string;
}

export interface RescuedAllyIntegrationConfig {
  levelId: string;
  rescueId: string;
  ally: RescuedAllyIdentityConfig;
  initialWeapon: RescuedAllyWeaponConfig;
  control: RescuedAllyControlConfig;
  hud: RescuedAllyHudConfig;
}

export interface AllyEquipmentState {
  weaponId: string;
  weaponName: string;
  ammo: number;
}

export interface RescuedAllyRuntimeState {
  levelId: string;
  rescueId: string;
  allyId: string;
  isRescued: boolean;
  isActiveInParty: boolean;
  controlMode: AllyControlMode;
  controllingSlot?: PlayerSlot;
  equippedWeapon?: AllyEquipmentState;
  integratedAtMs?: number;
}

export interface GroupStatusSnapshot {
  totalPartyMembers: number;
  humanControlledMembers: number;
  aiControlledMembers: number;
  rescuedMembers: number;
}

export interface AllyStatusSnapshot {
  allyId: string;
  codename: string;
  isActiveInParty: boolean;
  controlMode: AllyControlMode;
  controllingSlot?: PlayerSlot;
  equippedWeapon?: AllyEquipmentState;
}

export interface HudStateWriter {
  setValue: (key: string, value: unknown) => void;
}

export interface RescueIntegrationCallbacks {
  onControlModeResolved?: (state: RescuedAllyRuntimeState) => void;
  onIntegrated?: (state: RescuedAllyRuntimeState, group: GroupStatusSnapshot, ally: AllyStatusSnapshot) => void;
}

export interface IntegrateRescuedAllyInput {
  /**
   * Slots con jugador humano realmente disponibles cuando termina el rescate.
   * - Modo solitario: normalmente []
   * - Coop local: p.ej. [2] o [3,4]
   */
  availableHumanSlots: PlayerSlot[];
  /**
   * Miembros ya existentes en el grupo del jugador (sin contar la rescatada).
   */
  existingPartyMembers: number;
  /**
   * Cuántos miembros del grupo ya están bajo IA antes de sumar a la rescatada.
   */
  existingAiControlledMembers: number;
  integratedAtMs: number;
}

/**
 * Sistema liviano para incorporar a la compañera rescatada al grupo.
 *
 * Cubre el flujo MVP solicitado:
 * - Activarla como miembro del grupo tras el rescate.
 * - Asignarle arma inicial (sin inventario complejo).
 * - Resolver control humano o IA fallback para solitario/coop local.
 * - Actualizar estado de HUD/party de forma simple.
 */
export class RescuedAllyIntegrationSystem {
  private readonly config: RescuedAllyIntegrationConfig;
  private readonly hudWriter: HudStateWriter;
  private readonly callbacks: RescueIntegrationCallbacks;

  private state: RescuedAllyRuntimeState;

  static fromJson(
    jsonConfig: RescuedAllyIntegrationConfig,
    hudWriter: HudStateWriter,
    callbacks: RescueIntegrationCallbacks = {}
  ): RescuedAllyIntegrationSystem {
    return new RescuedAllyIntegrationSystem(jsonConfig, hudWriter, callbacks);
  }

  constructor(
    config: RescuedAllyIntegrationConfig,
    hudWriter: HudStateWriter,
    callbacks: RescueIntegrationCallbacks = {}
  ) {
    this.validateConfig(config);

    this.config = config;
    this.hudWriter = hudWriter;
    this.callbacks = callbacks;

    this.state = {
      levelId: config.levelId,
      rescueId: config.rescueId,
      allyId: config.ally.id,
      isRescued: false,
      isActiveInParty: false,
      controlMode: 'unassigned'
    };

    this.pushHudState({
      totalPartyMembers: 0,
      humanControlledMembers: 0,
      aiControlledMembers: 0,
      rescuedMembers: 0
    });
  }

  getState(): RescuedAllyRuntimeState {
    return { ...this.state, equippedWeapon: this.cloneWeapon(this.state.equippedWeapon) };
  }

  integrateAfterRescue(input: IntegrateRescuedAllyInput): RescuedAllyRuntimeState {
    if (this.state.isRescued) {
      return this.getState();
    }

    this.state.isRescued = true;
    this.state.isActiveInParty = true;
    this.state.integratedAtMs = input.integratedAtMs;
    this.state.equippedWeapon = {
      weaponId: this.config.initialWeapon.id,
      weaponName: this.config.initialWeapon.name,
      ammo: this.config.initialWeapon.ammo
    };

    const controlResolution = this.resolveControlMode(input.availableHumanSlots);
    this.state.controlMode = controlResolution.mode;
    this.state.controllingSlot = controlResolution.slot;

    this.callbacks.onControlModeResolved?.(this.getState());

    const groupStatus: GroupStatusSnapshot = {
      totalPartyMembers: input.existingPartyMembers + 1,
      humanControlledMembers: input.existingPartyMembers + (controlResolution.mode === 'human' ? 1 : 0),
      aiControlledMembers: input.existingAiControlledMembers + (controlResolution.mode === 'ai' ? 1 : 0),
      rescuedMembers: 1
    };

    const allyStatus: AllyStatusSnapshot = {
      allyId: this.config.ally.id,
      codename: this.config.ally.codename,
      isActiveInParty: this.state.isActiveInParty,
      controlMode: this.state.controlMode,
      controllingSlot: this.state.controllingSlot,
      equippedWeapon: this.cloneWeapon(this.state.equippedWeapon)
    };

    this.pushHudState(groupStatus, allyStatus);

    this.callbacks.onIntegrated?.(this.getState(), groupStatus, allyStatus);
    return this.getState();
  }

  describeTransition(): { beforeRescue: string; afterRescue: string } {
    const beforeRescue =
      'Antes del rescate: la compañera no está activa en el grupo, no tiene arma asignada y no participa del control humano/IA.';

    const controlText =
      this.state.controlMode === 'human'
        ? `queda bajo control humano (slot ${this.state.controllingSlot}).`
        : this.state.controlMode === 'ai'
          ? 'queda bajo IA por falta de slot humano disponible.'
          : 'permanece sin controlador asignado (configuración excepcional).';

    const afterRescue = this.state.isRescued
      ? `Después del rescate: la compañera se activa en el grupo, recibe ${this.config.initialWeapon.name} (${this.config.initialWeapon.ammo} balas) y ${controlText}`
      : 'Después del rescate: aún no se ejecutó la integración.';

    return { beforeRescue, afterRescue };
  }

  private resolveControlMode(availableHumanSlots: PlayerSlot[]): { mode: AllyControlMode; slot?: PlayerSlot } {
    const preferred = this.config.control.preferredHumanSlots.find((slot) => availableHumanSlots.includes(slot));
    if (preferred !== undefined) {
      return { mode: 'human', slot: preferred };
    }

    if (this.config.control.allowAnyHumanSlot) {
      const anySlot = availableHumanSlots[0];
      if (anySlot !== undefined) {
        return { mode: 'human', slot: anySlot };
      }
    }

    if (this.config.control.allowAiFallback) {
      return { mode: 'ai' };
    }

    return { mode: 'unassigned' };
  }

  private pushHudState(groupStatus: GroupStatusSnapshot, allyStatus?: AllyStatusSnapshot): void {
    this.hudWriter.setValue(this.config.hud.groupStatusRegistryKey, groupStatus);

    this.hudWriter.setValue(
      this.config.hud.allyStatusRegistryKey,
      allyStatus ?? {
        allyId: this.config.ally.id,
        codename: this.config.ally.codename,
        isActiveInParty: this.state.isActiveInParty,
        controlMode: this.state.controlMode,
        controllingSlot: this.state.controllingSlot,
        equippedWeapon: this.cloneWeapon(this.state.equippedWeapon)
      }
    );
  }

  private cloneWeapon(weapon?: AllyEquipmentState): AllyEquipmentState | undefined {
    if (!weapon) {
      return undefined;
    }

    return { ...weapon };
  }

  private validateConfig(config: RescuedAllyIntegrationConfig): void {
    if (config.levelId.trim().length === 0) {
      throw new Error('RescuedAllyIntegrationSystem: levelId es obligatorio.');
    }

    if (config.rescueId.trim().length === 0) {
      throw new Error('RescuedAllyIntegrationSystem: rescueId es obligatorio.');
    }

    if (config.ally.id.trim().length === 0 || config.ally.codename.trim().length === 0) {
      throw new Error('RescuedAllyIntegrationSystem: ally.id y ally.codename son obligatorios.');
    }

    if (config.initialWeapon.id.trim().length === 0 || config.initialWeapon.name.trim().length === 0) {
      throw new Error('RescuedAllyIntegrationSystem: initialWeapon.id y initialWeapon.name son obligatorios.');
    }

    if (config.initialWeapon.ammo < 0) {
      throw new Error('RescuedAllyIntegrationSystem: initialWeapon.ammo no puede ser negativo.');
    }

    if (!config.control.allowAiFallback && !config.control.allowAnyHumanSlot && config.control.preferredHumanSlots.length === 0) {
      throw new Error(
        'RescuedAllyIntegrationSystem: no hay ruta de control válida (ni slot humano ni fallback IA).'
      );
    }

    if (config.hud.groupStatusRegistryKey.trim().length === 0 || config.hud.allyStatusRegistryKey.trim().length === 0) {
      throw new Error('RescuedAllyIntegrationSystem: hud.groupStatusRegistryKey y hud.allyStatusRegistryKey son obligatorios.');
    }
  }
}
