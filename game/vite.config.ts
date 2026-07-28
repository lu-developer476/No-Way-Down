import { defineConfig } from 'vite'
import { createBuildInfo } from './build/buildInfoConfig'
export default defineConfig(({ mode }) => ({
  define: {
    __NWD_BUILD_INFO__: JSON.stringify(createBuildInfo(process.env, mode))
  },
  // Use the project's local public/ folder so Vite copies game/public (assets, dialogues, cinematics, levels) into dist.
  publicDir: 'public',
  server: {
    host: '0.0.0.0',
    port: 5173
  }
}))
