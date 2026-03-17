import Phaser from 'phaser';
import environmentManifest from '../../public/assets/images/environment/bna_environment_manifest.json';
import tilesetsByZone from '../../public/assets/images/environment/bna_tilesets_by_zone.json';
import propsByZone from '../../public/assets/images/environment/bna_props_by_zone.json';
import backgroundLayers from '../../public/assets/images/environment/bna_background_layers.json';
import interactiveObjects from '../../public/assets/images/environment/bna_interactive_objects.json';
import levelVariants from '../../public/assets/images/environment/bna_level_variants.json';

export interface EnvironmentLevelVariant {
  level: number;
  id: string;
  zones: string[];
  visual_mood: string;
  density_profile: string;
  reuse_from: number[];
}

export interface EnvironmentProfile {
  manifestId: string;
  level: EnvironmentLevelVariant;
  zoneTilesets: Record<string, unknown>;
  zoneProps: Record<string, unknown>;
  zoneLayerPreset: Record<string, unknown>;
  interactiveObjects: unknown[];
  coherenceRules: string[];
}

const levelVariantList = levelVariants.levels as EnvironmentLevelVariant[];

function normalizeProfileId(levelId: string): string {
  return levelId.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
}

function resolveEnvironmentVariant(levelId: string): EnvironmentLevelVariant | undefined {
  const normalized = normalizeProfileId(levelId);
  const direct = levelVariantList.find((entry) => normalizeProfileId(entry.id) === normalized);
  if (direct) {
    return direct;
  }

  // Compatibilidad para runtime ids con formato "level_2_subsuelo".
  const numericAlias = normalized.match(/^level_(\d+)_(.+)$/);
  if (!numericAlias) {
    return undefined;
  }

  const [, levelNumber, suffix] = numericAlias;
  return levelVariantList.find((entry) => normalizeProfileId(entry.id) === `level${levelNumber}_${suffix}`);
}

export function getEnvironmentProfileForLevel(levelId: string): EnvironmentProfile | undefined {
  const level = resolveEnvironmentVariant(levelId);

  if (!level) {
    return undefined;
  }

  const zoneTilesets = Object.fromEntries(
    level.zones.map((zone) => [zone, tilesetsByZone.zones[zone as keyof typeof tilesetsByZone.zones]])
  );

  const zoneProps = Object.fromEntries(
    level.zones.map((zone) => [zone, propsByZone.zone_prop_sets[zone as keyof typeof propsByZone.zone_prop_sets]])
  );

  const zoneLayerPreset = Object.fromEntries(
    level.zones.map((zone) => [zone, backgroundLayers.layer_presets_by_zone[zone as keyof typeof backgroundLayers.layer_presets_by_zone]])
  );

  return {
    manifestId: environmentManifest.manifest_id,
    level,
    zoneTilesets,
    zoneProps,
    zoneLayerPreset,
    interactiveObjects: interactiveObjects.interactive_objects,
    coherenceRules: environmentManifest.coherence_rules
  };
}

export function registerEnvironmentProfile(scene: Phaser.Scene, levelId: string): void {
  const profile = getEnvironmentProfileForLevel(levelId);

  scene.registry.set('environmentProfileId', profile?.level.id ?? levelId);
  scene.registry.set('environmentProfile', profile ?? null);
}
