import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

export interface BuildEnvironment {
  NWD_BUILD_SHA?: string; RENDER_GIT_COMMIT?: string; GITHUB_SHA?: string;
  NWD_BUILT_AT?: string; NWD_BRANCH?: string; RENDER_GIT_BRANCH?: string;
  GITHUB_REF_NAME?: string; RENDER_DEPLOY_ID?: string
}
export interface BuildInfoValues {
  frontendSha: string; branch: string; buildId: string; builtAt: string;
  canonicalNodeCount: number; generatedArtCount: number; packageVersion: string;
  readonly sha: string; readonly shortSha: string; readonly mode: string; readonly version: string
}

export function resolveBuildSha(environment: BuildEnvironment, gitFallback = resolveGitSha): string {
  for (const name of ['NWD_BUILD_SHA', 'RENDER_GIT_COMMIT', 'GITHUB_SHA'] as const) {
    const value = environment[name]?.trim()
    if (value) return value
  }
  return gitFallback()
}

export function resolveGitSha(): string {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() || 'unknown' }
  catch { return 'unknown' }
}

export function createBuildInfo(environment: BuildEnvironment, mode: string, now = new Date(), gitFallback = resolveGitSha): BuildInfoValues {
  const frontendSha = resolveBuildSha(environment, gitFallback)
  if (mode === 'production' && frontendSha === 'unknown') throw new Error('A production build requires a resolvable Git SHA')
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
  const campaign = JSON.parse(readFileSync(new URL('../public/assets/campaign/canonical_campaign_manifest.json', import.meta.url), 'utf8')) as { canonicalNodeCount: number }
  const generatedArt = JSON.parse(readFileSync(new URL('../config/generated-production-art.json', import.meta.url), 'utf8')) as { assets: unknown[] }
  const requestedTime = environment.NWD_BUILT_AT?.trim()
  const builtAt = requestedTime ? new Date(requestedTime).toISOString() : now.toISOString()
  const branch = environment.NWD_BRANCH?.trim() || environment.RENDER_GIT_BRANCH?.trim() || environment.GITHUB_REF_NAME?.trim() || 'local'
  const buildId = environment.RENDER_DEPLOY_ID?.trim() || `${frontendSha.slice(0, 12)}-${builtAt}`
  return { frontendSha, branch, buildId, builtAt, canonicalNodeCount: campaign.canonicalNodeCount, generatedArtCount: generatedArt.assets.length, packageVersion: packageJson.version, sha: frontendSha, shortSha: frontendSha.slice(0, 7), mode, version: packageJson.version }
}
