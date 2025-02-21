// https://vite.dev/guide/build
// https://vite.dev/config/build-options#build-lib
// export default defineConfig({ build: { lib: {
//      entry: ['src/adapter.ts'],
//      name: "PulseBeamAdapterPeerJS",
//      fileName: (format, entryName) => `pulsebeam-adapter-peerjs-${entryName}.${format}.js`,
// }}})
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { dirname, resolve} from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'es2020',
    lib: {
      entry: resolve(__dirname, 'lib/exports.ts'),
      name: 'PeerJS',
    },
    sourcemap: true,
    rollupOptions: {
      external: [
        '@pulsebeam/peer',
      ],
      output: [
        // CJS
        {
          entryFileNames: 'bundler.cjs',
          format: 'cjs',
          inlineSources: true
        },
        // ESM
        {
          entryFileNames: 'bundler.mjs',
          format: 'es',
          inlineSources: true
        },
        // UMD (unminified)
        {
          entryFileNames: 'peerjs.js',
          format: 'umd',
          name: 'PeerJS',
        },
        // UMD (minified with esbuild)
        {
          entryFileNames: 'peerjs.min.js',
          format: 'umd',
          name: 'PeerJS',
          minify: true
        },
        // MsgPack ESM (minified)
        {
          entryFileNames: 'serializer.msgpack.mjs',
          format: 'es',
          minify: true
        }
      ]
    }
  },
  plugins: [
    dts({
      entryRoot: 'lib',
      outputDir: 'dist',
      compilerOptions: {
        declaration: true,
        declarationMap: true
      }
    })
  ],
//   resolve: {
//     alias: {
//       'process': false,
//       'buffer': false
//     }
//   }
});