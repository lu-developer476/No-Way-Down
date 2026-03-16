import { CharacterInventoryLoadout, CharacterWeaponKey } from '../../config/characterRuntime';
import { getWeaponCatalogEntry } from '../../config/weaponCatalog';

const STARTING_RESERVE_MAGAZINES = 3;

export interface ActiveWeaponAmmoSnapshot {
  usesAmmo: boolean;
  ammoType?: string;
  ammoCurrent?: number;
  ammoMax?: number;
  ammoReserve?: number;
}

export class WeaponAmmoRuntime {
  private readonly ammoCurrentByWeapon = new Map<string, number>();
  private readonly ammoReserveByType = new Map<string, number>();

  constructor(loadout: CharacterInventoryLoadout) {
    loadout.inventory.forEach((weaponKey) => {
      const weapon = getWeaponCatalogEntry(weaponKey);
      if (!weapon.usesAmmo || !weapon.ammoType) {
        return;
      }

      this.ammoCurrentByWeapon.set(weaponKey, weapon.magazineSize);
      const currentReserve = this.ammoReserveByType.get(weapon.ammoType) ?? 0;
      this.ammoReserveByType.set(weapon.ammoType, currentReserve + weapon.magazineSize * STARTING_RESERVE_MAGAZINES);
    });
  }

  canFire(weaponKey: CharacterWeaponKey): boolean {
    const weapon = getWeaponCatalogEntry(weaponKey);
    if (!weapon.usesAmmo || !weapon.ammoType) {
      return true;
    }

    return (this.ammoCurrentByWeapon.get(weapon.key) ?? weapon.magazineSize) > 0;
  }

  consumeForShot(weaponKey: CharacterWeaponKey): boolean {
    const weapon = getWeaponCatalogEntry(weaponKey);
    if (!weapon.usesAmmo || !weapon.ammoType) {
      return true;
    }

    const ammoCurrent = this.ammoCurrentByWeapon.get(weapon.key) ?? weapon.magazineSize;
    if (ammoCurrent <= 0) {
      return false;
    }

    this.ammoCurrentByWeapon.set(weapon.key, ammoCurrent - 1);
    return true;
  }

  canReload(weaponKey: CharacterWeaponKey): boolean {
    const weapon = getWeaponCatalogEntry(weaponKey);
    if (!weapon.usesAmmo || !weapon.ammoType || weapon.magazineSize <= 0) {
      return false;
    }

    const ammoCurrent = this.ammoCurrentByWeapon.get(weapon.key) ?? weapon.magazineSize;
    if (ammoCurrent >= weapon.magazineSize) {
      return false;
    }

    return (this.ammoReserveByType.get(weapon.ammoType) ?? 0) > 0;
  }

  reload(weaponKey: CharacterWeaponKey): number {
    const weapon = getWeaponCatalogEntry(weaponKey);
    if (!weapon.usesAmmo || !weapon.ammoType || weapon.magazineSize <= 0) {
      return 0;
    }

    const ammoCurrent = this.ammoCurrentByWeapon.get(weapon.key) ?? weapon.magazineSize;
    const reserve = this.ammoReserveByType.get(weapon.ammoType) ?? 0;
    const missing = Math.max(0, weapon.magazineSize - ammoCurrent);
    const loaded = Math.min(missing, reserve);

    if (loaded <= 0) {
      return 0;
    }

    this.ammoCurrentByWeapon.set(weapon.key, ammoCurrent + loaded);
    this.ammoReserveByType.set(weapon.ammoType, reserve - loaded);
    return loaded;
  }

  getSnapshotForWeapon(weaponKey: CharacterWeaponKey): ActiveWeaponAmmoSnapshot {
    const weapon = getWeaponCatalogEntry(weaponKey);
    if (!weapon.usesAmmo || !weapon.ammoType) {
      return {
        usesAmmo: false
      };
    }

    return {
      usesAmmo: true,
      ammoType: weapon.ammoType,
      ammoCurrent: this.ammoCurrentByWeapon.get(weapon.key) ?? weapon.magazineSize,
      ammoMax: weapon.magazineSize,
      ammoReserve: this.ammoReserveByType.get(weapon.ammoType) ?? 0
    };
  }
}
