import { defineConfig } from 'vite'
import { createBuildInfo } from './build/buildInfoConfig'
export default defineConfig(({ mode }) => ({
  define: {
    __NWD_BUILD_INFO__: JSON.stringify(createBuildInfo(process.env, mode))
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
}))
