import { defineConfig, type Plugin } from 'vite'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createBuildInfo } from './build/buildInfoConfig'
const buildInfoPlugin = (info: ReturnType<typeof createBuildInfo>): Plugin => ({
  name: 'nwd-build-info',
  closeBundle() {
    mkdirSync(resolve(import.meta.dirname, 'dist'), { recursive: true })
    writeFileSync(resolve(import.meta.dirname, 'dist/build-info.json'), `${JSON.stringify(info, null, 2)}\n`)
  }
})
export default defineConfig(({ mode }) => {
 const info = createBuildInfo(process.env, mode)
 return ({
  plugins: [buildInfoPlugin(info)],
  define: {
    __NWD_BUILD_INFO__: JSON.stringify(info)
  },
  // Use the project's local public/ folder so Vite copies game/public (assets, dialogues, cinematics, levels) into dist.
  publicDir: 'public',
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/phaser/')) return 'phaser-vendor'
          if (id.includes('/src/tiled/') || id.includes('/src/visual/')) return 'level-presentation'
          return undefined
        }
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5173
  }
 })
})
