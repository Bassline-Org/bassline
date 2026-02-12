import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Test organization by type
    // Run all: pnpm test
    // Run specific: pnpm test:unit, pnpm test:property, pnpm test:integration
    include: ['packages/*/test/**/*.test.js', 'packages/*/test/**/*.property.test.js', 'test/**/*.test.js', 'apps/*/src/**/*.test.js'],
  },
})

// Named project configs for selective test runs
export const unitConfig = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/test/**/*.test.js'],
    exclude: ['**/*.property.test.js', '**/*.integration.test.js'],
  },
})

export const propertyConfig = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.property.test.js'],
  },
})

export const integrationConfig = defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.test.js'],
  },
})
