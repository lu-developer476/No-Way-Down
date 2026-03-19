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
  layerDefinitions: Record<string, EnvironmentBackgroundLayer>;
  interactiveObjects: unknown[];
  coherenceRules: string[];
}

export interface EnvironmentBackgroundLayer {
  id: string;
  parallax: number;
  description: string;
}

export interface EnvironmentZoneVisual {
  wallTop: number;
  wallMid: number;
  wallBottom: number;
  trim: number;
  floor: number;
  floorShadow: number;
  glow: number;
  overlayAlpha: number;
}

const ZONE_VISUALS: Record<string, EnvironmentZoneVisual> = {
  servicios_comedor_cocina: {
    wallTop: 0xcbb99a,
    wallMid: 0xb29a76,
    wallBottom: 0x8e7556,
    trim: 0x5f4738,
    floor: 0x63493a,
    floorShadow: 0x251b16,
    glow: 0xf1c77a,
    overlayAlpha: 0.18
  },
  subsuelo_estacionamiento: {
    wallTop: 0x8e8a84,
    wallMid: 0x6f6a64,
    wallBottom: 0x4f4a45,
    trim: 0x302c29,
    floor: 0x403936,
    floorShadow: 0x171413,
    glow: 0xc7d4df,
    overlayAlpha: 0.14
  },
  pisos_oficina: {
    wallTop: 0xd4c7b0,
    wallMid: 0xbeac8d,
    wallBottom: 0x9f8868,
    trim: 0x65493a,
    floor: 0x6f4e43,
    floorShadow: 0x231817,
    glow: 0xf3d59a,
    overlayAlpha: 0.12
  },
  hall_publico: {
    wallTop: 0xe1d3ba,
    wallMid: 0xc9b28d,
    wallBottom: 0xa88762,
    trim: 0x6c4938,
    floor: 0x7a4d42,
    floorShadow: 0x241918,
    glow: 0xf6d28b,
    overlayAlpha: 0.1
  },
  circulacion_vertical: {
    wallTop: 0xcfc2ad,
    wallMid: 0xa99272,
    wallBottom: 0x7b644d,
    trim: 0x4d3b32,
    floor: 0x5b463b,
    floorShadow: 0x1d1513,
    glow: 0xf0c178,
    overlayAlpha: 0.16
  },
  exterior_calle_lateral: {
    wallTop: 0x90a8bf,
    wallMid: 0x6c869d,
    wallBottom: 0x485f74,
    trim: 0x23313f,
    floor: 0x394a56,
    floorShadow: 0x10161b,
    glow: 0xc9e7ff,
    overlayAlpha: 0.08
  }
};

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

  const layerDefinitions = Object.fromEntries(
    (backgroundLayers.layers as EnvironmentBackgroundLayer[]).map((layer) => [layer.id, layer])
  );

  return {
    manifestId: environmentManifest.manifest_id,
    level,
    zoneTilesets,
    zoneProps,
    zoneLayerPreset,
    layerDefinitions,
    interactiveObjects: interactiveObjects.interactive_objects,
    coherenceRules: environmentManifest.coherence_rules
  };
}

export function getEnvironmentZoneVisual(zoneId: string): EnvironmentZoneVisual {
  return ZONE_VISUALS[zoneId] ?? ZONE_VISUALS.hall_publico;
}

export function registerEnvironmentProfile(scene: Phaser.Scene, levelId: string): void {
  const profile = getEnvironmentProfileForLevel(levelId);

  scene.registry.set('environmentProfileId', profile?.level.id ?? levelId);
  scene.registry.set('environmentProfile', profile ?? null);
}
