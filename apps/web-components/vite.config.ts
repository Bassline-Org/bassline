import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  build: {
    target: 'esnext',
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: 'index.html'
      }
    }
  },
  server: {
    port: 3001,
    open: true
  }
})
