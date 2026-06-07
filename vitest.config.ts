import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Separate from vite.config.ts so the production build stays free of test
// concerns. Vitest auto-prefers this file.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    include: ['src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      // `include` enumerates every matching file in the report (even untested
      // ones, which surface as 0% and trip the threshold) — Vitest 4's default.
      include: ['src/**/*.{ts,tsx}'],
      // Excluded from the coverage denominator:
      //  - useWisteriaTunnel: a <canvas> 2D engine that can't execute in jsdom
      //    (getContext returns null), so it's verified via the live Playwright
      //    run instead of unit tests.
      //  - main.tsx: the ReactDOM bootstrap.
      //  - test setup + type-only files.
      exclude: [
        'src/hooks/useWisteriaTunnel.ts',
        'src/main.tsx',
        'src/test/**',
        'src/**/*.test.{ts,tsx}',
        'src/vite-env.d.ts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
