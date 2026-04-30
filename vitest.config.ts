import { defineConfig } from 'vitest/config'

/**
 * Root vitest config — runs root-level (tools) tests under tests/ and dev/.
 *
 * Workspace packages with their own tests MUST ship a local
 * `packages/<name>/vitest.config.ts` (even an empty `defineConfig({})` works).
 * Without it, vitest walks up to this root config, the `include` below does
 * not match `packages/<name>/src/__tests__/*.test.ts`, and the package's
 * tests silently disappear from `pnpm -r test`.
 *
 * `packages/shared/vitest.config.ts` is the canonical example.
 */
export default defineConfig({
  test: {
    globals: false,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'dev/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.config.*'],
    },
  },
})
