import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'

const packageVersion = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version as string
const gitSha = (): string => {
  for (const value of [process.env.RENDER_GIT_COMMIT, process.env.GITHUB_SHA, process.env.NWD_BUILD_SHA]) {
    if (value?.trim()) return value.trim()
  }
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

const sha = gitSha()
export default defineConfig(({ mode }) => ({
  define: {
    __NWD_BUILD_INFO__: JSON.stringify({
      sha,
      shortSha: sha === 'unknown' ? 'unknown' : sha.slice(0, 7),
      builtAt: process.env.NWD_BUILT_AT ?? new Date().toISOString(),
      mode,
      version: packageVersion
    })
  },
  // Use the project's local public/ folder so Vite copies game/public (assets, dialogues, cinematics, levels) into dist.
  publicDir: 'public',
  server: {
    host: '0.0.0.0',
    port: 5173
  }
}))
