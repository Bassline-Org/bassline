import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'
import path from 'path'

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 5174, // Different from editor (5173)
    watch: {
      // Watch the structure-editor package for HMR
      ignored: ['!**/node_modules/@bassline/**'],
    },
  },
  optimizeDeps: {
    // Don't pre-bundle our workspace packages so changes are picked up
    exclude: ['@bassline/structure-editor'],
  },
  resolve: {
    alias: {
      // Ensure we use the source files directly
      '@bassline/structure-editor': path.resolve(__dirname, '../../packages/structure-editor/src'),
    },
  },
  build: {
    target: 'esnext',
  },
})
