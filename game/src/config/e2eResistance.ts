export const MIN_E2E_RESISTANCE_MS = 100;

/** The query fixture changes duration only; callers retain every campaign field. */
export function resolveResistanceDuration(configuredDurationMs: number, query: string): number {
  const raw = new URLSearchParams(query).get('e2eResistanceMs');
  return raw === null ? configuredDurationMs : Math.max(MIN_E2E_RESISTANCE_MS, Number(raw) || configuredDurationMs);
}
