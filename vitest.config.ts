import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Mirror tsconfig.paths so the vendored CLC packages resolve under vitest.
export default defineConfig({
  resolve: {
    alias: {
      '@clc/api': fileURLToPath(new URL('./vendor/clc/api', import.meta.url)),
      '@clc/core': fileURLToPath(new URL('./vendor/clc/core', import.meta.url)),
    },
  },
});
