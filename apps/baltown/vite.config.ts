import { defineConfig } from 'vite'
import solidPlugin from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solidPlugin()],
  server: {
    port: 5174,  // Different from editor (5173)
  },
  build: {
    target: 'esnext',
  },
})
