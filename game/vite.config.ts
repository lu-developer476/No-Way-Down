import { defineConfig } from 'vite'

export default defineConfig({
  // Use the project's local public/ folder so Vite copies game/public (assets, dialogues, cinematics, levels) into dist.
  publicDir: 'public',
  server: {
    host: '0.0.0.0',
    port: 5173
  }
})
