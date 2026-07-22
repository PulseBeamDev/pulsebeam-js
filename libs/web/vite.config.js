import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts';

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [dts()],
  resolve: {
    alias: {
      '@pulsebeam/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/lib.ts'),
      fileName: "lib",
      formats: ["es"]
    },
    rollupOptions: {
      external: [],
    },
  },
})
