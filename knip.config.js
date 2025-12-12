/** @type {import('knip').KnipConfig} */
export default {
  workspaces: {
    '.': {
      entry: ['apps/*/src/index.{js,ts,jsx,tsx}', 'apps/*/src/main.{js,ts,jsx,tsx}'],
      ignoreDependencies: ['typescript'],
    },
    'packages/*': {
      entry: ['src/index.{js,jsx}', 'src/upgrade.js'],
      ignoreDependencies: [],
    },
    'apps/*': {
      entry: ['src/index.{js,ts,jsx,tsx}', 'src/main.{js,ts,jsx,tsx}'],
    },
  },
  ignore: ['**/*.d.ts', 'docs/**'],
  ignoreDependencies: ['@types/*'],
}
