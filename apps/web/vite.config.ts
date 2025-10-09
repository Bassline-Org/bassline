import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  define: {
    global: 'globalThis',
  },
  resolve: {
    alias: {
      // Polyfill Node.js modules for browser compatibility
      'events': 'events'
    }
  },
  optimizeDeps: {
    include: ['events']
  },
  ssr: {
    external: ['@bassline/core', '@bassline/react']
  },
  server: {
    watch: {
      // Watch the source directories of workspace packages
      ignored: ['!**/node_modules/port-graphs/**', '!**/node_modules/port-graphs-react/**']
    }
  }
});
