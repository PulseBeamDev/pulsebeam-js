import { defineConfig } from 'vite';
import { resolve, basename, extname } from 'path';
import dts from 'vite-plugin-dts';
import fg from 'fast-glob';

const componentEntries = Object.fromEntries(
    fg.sync(['src/components/*.ts'], { ignore: ['src/components/index.ts'] }).map(file => [
        `components/${basename(file, extname(file))}`,
        resolve(__dirname, file)
    ])
);

export default defineConfig({
    plugins: [dts({ rollupTypes: true })],
    build: {
        lib: {
            entry: {
                engine: resolve(__dirname, 'src/engine.ts'),
                'components/index': resolve(__dirname, 'src/components/index.ts'),
                ...componentEntries
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
