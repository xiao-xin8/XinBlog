import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
function cleanOldAssets(): Plugin {
  return {
    name: 'clean-old-assets',
    async writeBundle(_options, bundle) {
      const fs = await import('fs/promises')
      const outDir = path.resolve(__dirname, 'dist')
      const assetsDir = path.join(outDir, 'assets')
      const emitted = new Set<string>(Object.keys(bundle))
      const files = await fs.readdir(assetsDir).catch(() => [] as string[])
      for (const file of files) {
        if (!file.match(/-[A-Za-z0-9_-]+\.(js|css)$/)) continue
        if (!emitted.has(`assets/${file}`)) {
          await fs.unlink(path.join(assetsDir, file))
        }
      }
    },
  }
}
export default defineConfig({
  plugins: [react(), cleanOldAssets()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})