import type { CampaignFlowDefinition, CampaignFlowNode } from '../scenes/SceneFlowManager';

export const CANONICAL_NODE_COUNT = 35;

/** Legacy IDs are accepted only at the persistence boundary and immediately canonicalized. */
export const LEGACY_NODE_MIGRATIONS: Readonly<Record<string, string>> = Object.freeze({
  'lvl01-esc01-subsuelo-inicial': 'lvl01-esc01-comedor-resistencia',
  'lvl02-esc01-hall-planta-baja': 'lvl02-esc01-hall-planta-baja',
  'lvl03-esc01-segundo-piso': 'lvl03-esc01-segundo-piso',
  'lvl04-esc01-tercer-piso': 'lvl04-esc01-tercer-piso',
  'lvl05-esc01-cuarto-piso-comedor': 'lvl05-esc01-cuarto-piso-comedor',
  'lvl06-esc01-quinto-piso-pertenencias': 'lvl06-esc01-quinto-piso-pertenencias',
  'lvl07-esc01-oficina-422-rescate': 'lvl07-esc01-oficina-422-rescate',
  'lvl08-esc01-descenso-con-temporizador': 'lvl08-esc01-descenso-con-temporizador',
  'lvl09-esc01-verificacion-salidas': 'lvl09-esc01-verificacion-salidas',
  'lvl10-esc01-garage-busqueda-vehiculo': 'lvl10-esc01-garage-busqueda-vehiculo',
  'lvl10-esc02-resistencia-en-garage': 'lvl10-esc02-resistencia-en-garage',
  'lvl10-cin01-traslado-silencioso-plaza-de-mayo': 'lvl10-cin01-traslado-silencioso-plaza-de-mayo',
  'lvl10-esc03-combate-final-en-via-publica': 'lvl10-esc01-combate-50-bajas-en-via-publica',
  'lvl10-esc04-epilogo-final': 'lvl10-esc03-llegada-a-san-telmo'
});

export interface CanonicalManifest extends CampaignFlowDefinition {
  manifestVersion: number;
  canonicalNodeCount: number;
}

export interface ImplementationRegistry {
  registryVersion: number;
  nodes: Record<string, { implemented: boolean }>;
}

export function definitionFromManifest(manifest: CanonicalManifest): CampaignFlowDefinition {
  return { flowId: manifest.flowId, nodes: manifest.nodes };
}

export function migrateLegacyNodeId(nodeId: string | undefined, canonicalIds: ReadonlySet<string>): string | undefined {
  if (!nodeId) return undefined;
  const migrated = LEGACY_NODE_MIGRATIONS[nodeId] ?? nodeId;
  return canonicalIds.has(migrated) ? migrated : undefined;
}

export function resolveNodeNeighbours(nodes: readonly CampaignFlowNode[], nodeId: string): {
  previous?: CampaignFlowNode; current?: CampaignFlowNode; next?: CampaignFlowNode;
} {
  const index = nodes.findIndex((node) => node.id === nodeId);
  if (index < 0) return {};
  return { previous: nodes[index - 1], current: nodes[index], next: nodes[index + 1] };
}

export function isNodeImplemented(registry: ImplementationRegistry | undefined, nodeId: string): boolean {
  return registry?.nodes[nodeId]?.implemented === true;
}
