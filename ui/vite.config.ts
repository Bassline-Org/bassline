import { defineConfig } from 'vite'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts({
      include: ['src'],
      outDir: 'dist',
      rollupTypes: false,
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'core/index': resolve(__dirname, 'src/core/index.ts'),
        'react/index': resolve(__dirname, 'src/react/index.ts'),
        'components/index': resolve(__dirname, 'src/components/index.ts'),
        'zod-form/index': resolve(__dirname, 'src/zod-form/index.ts'),
        // New entry points
        'views/index': resolve(__dirname, 'src/views/index.ts'),
        'tools/index': resolve(__dirname, 'src/tools/index.ts'),
        'panes/index': resolve(__dirname, 'src/panes/index.ts'),
        'hooks/index': resolve(__dirname, 'src/hooks/index.ts'),
        'state/index': resolve(__dirname, 'src/state/index.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['react', 'react-dom', 'react/jsx-runtime', 'zod', '@autoform/react', '@autoform/zod'],
      output: {
        preserveModules: true,
        preserveModulesRoot: 'src',
        assetFileNames: 'styles[extname]',
      },
    },
    cssCodeSplit: false,
    sourcemap: true,
    minify: false,
  },
  resolve: {
    alias: [
      // More specific aliases first
      { find: '~/css', replacement: resolve(__dirname, 'css') },
      { find: '~', replacement: resolve(__dirname, 'src') },
    ],
  },
})
