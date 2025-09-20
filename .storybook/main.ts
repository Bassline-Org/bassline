import type { StorybookConfig } from '@storybook/react-vite';
import path from 'path';
import react from '@vitejs/plugin-react';

const config: StorybookConfig = {
  "stories": [
    "../stories/**/*.mdx",
    "../stories/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-docs",
    "@storybook/addon-onboarding",
    "@storybook/addon-a11y",
    "@storybook/addon-vitest"
  ],
  "framework": {
    "name": "@storybook/react-vite",
    "options": {}
  },
  async viteFinal(config) {
    // Add aliases for workspace packages
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...config.resolve.alias,
      'port-graphs': path.resolve(__dirname, '../port-graphs/src'),
      'port-graphs-react': path.resolve(__dirname, '../port-graphs-react/src'),
      '@/components': path.resolve(__dirname, '../apps/web/app/components'),
      '@/lib': path.resolve(__dirname, '../apps/web/app/lib'),
      '~/lib': path.resolve(__dirname, '../apps/web/app/lib'),
      '~': path.resolve(__dirname, '../apps/web/app'),
    };

    // Add React plugin with automatic JSX runtime
    config.plugins = config.plugins || [];
    config.plugins.push(
      react({
        jsxRuntime: 'automatic',
      })
    );

    return config;
  },
};
export default config;