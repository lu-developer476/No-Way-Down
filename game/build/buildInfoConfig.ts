import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

export interface BuildEnvironment {
  NWD_SOURCE_SHA?: string; NWD_BUILD_SHA?: string; NWD_FRONTEND_SHA?: string; NWD_DEPLOY_COMMIT?: string;
  NWD_REPOSITORY_PROVIDER?: string; RENDER_GIT_COMMIT?: string; GITHUB_SHA?: string;
  NWD_BUILT_AT?: string; NWD_BRANCH?: string; RENDER_GIT_BRANCH?: string;
  GITHUB_REF_NAME?: string; RENDER_DEPLOY_ID?: string
}
export interface BuildInfoValues {
  sourceSha: string; frontendSha: string; deployCommit: string; repositoryProvider: 'github'|'gitlab'|'unknown';
  branch: string; buildId: string; builtAt: string; canonicalNodeCount: number; generatedArtCount: number; packageVersion: string;
  readonly sha: string; readonly shortSha: string; readonly mode: string; readonly version: string
}
const value = (environment: BuildEnvironment, name: keyof BuildEnvironment) => environment[name]?.trim()
export function resolveBuildSha(environment: BuildEnvironment, gitFallback = resolveGitSha): string {
  return value(environment, 'NWD_SOURCE_SHA') || value(environment, 'NWD_BUILD_SHA') || value(environment, 'GITHUB_SHA') || value(environment, 'RENDER_GIT_COMMIT') || gitFallback()
}
export function resolveGitSha(): string { try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() || 'unknown' } catch { return 'unknown' } }
function detectRepositoryProvider(environment: BuildEnvironment): 'github'|'gitlab'|'unknown' {
  const explicit = value(environment, 'NWD_REPOSITORY_PROVIDER')
  if (explicit === 'github' || explicit === 'gitlab') return explicit
  let remote = ''
  try { remote = execFileSync('git', ['config', '--get', 'remote.origin.url'], { encoding: 'utf8' }).trim() } catch { return 'unknown' }
  const sanitized = remote.replace(/^[a-z]+:\/\/[^/@]+@/i, 'https://').toLowerCase()
  let hostname = ''
  try { hostname = new URL(sanitized).hostname } catch { hostname = sanitized.match(/@?([^/:]+)[:/]/)?.[1] ?? '' }
  if (hostname === 'github.com' || hostname.endsWith('.github.com')) return 'github'
  if (hostname === 'gitlab.com' || hostname.startsWith('gitlab.')) return 'gitlab'
  return 'unknown'
}
export function createBuildInfo(environment: BuildEnvironment, mode: string, now = new Date(), gitFallback = resolveGitSha): BuildInfoValues {
  const sourceSha = resolveBuildSha(environment, gitFallback)
  if (mode === 'production' && sourceSha === 'unknown') throw new Error('A production build requires a resolvable Git SHA')
  const deployCommit = value(environment, 'NWD_DEPLOY_COMMIT') || value(environment, 'RENDER_GIT_COMMIT') || gitFallback()
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
  const campaign = JSON.parse(readFileSync(new URL('../public/assets/campaign/canonical_campaign_manifest.json', import.meta.url), 'utf8')) as { canonicalNodeCount: number }
  const generatedArt = JSON.parse(readFileSync(new URL('../config/generated-production-art.json', import.meta.url), 'utf8')) as { assets: unknown[] }
  const requestedTime = value(environment, 'NWD_BUILT_AT'); const builtAt = requestedTime ? new Date(requestedTime).toISOString() : now.toISOString()
  const branch = value(environment, 'NWD_BRANCH') || value(environment, 'RENDER_GIT_BRANCH') || value(environment, 'GITHUB_REF_NAME') || 'local'
  const buildId = value(environment, 'RENDER_DEPLOY_ID') || `${sourceSha.slice(0, 12)}-${builtAt}`
  return { sourceSha, frontendSha: sourceSha, deployCommit, repositoryProvider: detectRepositoryProvider(environment), branch, buildId, builtAt, canonicalNodeCount: campaign.canonicalNodeCount, generatedArtCount: generatedArt.assets.length, packageVersion: packageJson.version, sha: sourceSha, shortSha: sourceSha.slice(0, 7), mode, version: packageJson.version }
}
