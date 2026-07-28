import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

export interface BuildEnvironment { NWD_BUILD_SHA?: string; GITHUB_SHA?: string; RENDER_GIT_COMMIT?: string; NWD_BUILD_TIME?: string }
export interface BuildInfoValues { sha: string; shortSha: string; builtAt: string; mode: string; version: string }

export function resolveBuildSha(environment: BuildEnvironment, gitFallback = resolveGitSha): string {
  for (const name of ['NWD_BUILD_SHA', 'GITHUB_SHA', 'RENDER_GIT_COMMIT'] as const) {
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
  const sha = resolveBuildSha(environment, gitFallback)
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
  const requestedTime = environment.NWD_BUILD_TIME?.trim()
  return { sha, shortSha: sha === 'unknown' ? 'unknown' : sha.slice(0, 7), builtAt: requestedTime ? new Date(requestedTime).toISOString() : now.toISOString(), mode, version: packageJson.version }
}
