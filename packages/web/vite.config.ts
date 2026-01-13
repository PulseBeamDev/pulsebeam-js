import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: {
        components: resolve(__dirname, 'src/components/index.ts'),
        engine: resolve(__dirname, 'src/engine.ts')
      },
      formats: ['es']
    },
    rollupOptions: {
      external: [
        'lit',
        '@material/web',
        '@pulsebeam/core',
        'material-symbols',
        /^@fontsource\//,
        /^@material\/web\//
      ]
    }
  }
});
