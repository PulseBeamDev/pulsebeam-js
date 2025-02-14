// https://vite.dev/guide/build
// https://vite.dev/config/build-options#build-lib
// export default defineConfig({ build: { lib: {
//      entry: ['src/adapter.ts'],
//      name: "PulseBeamAdapterPeerJS",
//      fileName: (format, entryName) => `pulsebeam-adapter-peerjs-${entryName}.${format}.js`,
// }}})
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'es2020',
    lib: {
      entry: {
        'bundler': 'lib/exports.ts',
        'peerjs': 'lib/global.ts',
        'serializer.msgpack': 'lib/dataconnection/StreamConnection/MsgPack.ts'
      },
      formats: ['es', 'cjs', 'umd']
    },
    rollupOptions: {
      external: ['eventemitter3'],
      output: [
        // CJS
        {
          entryFileNames: 'bundler.cjs',
          format: 'cjs',
          sourcemap: true,
          inlineSources: true
        },
        // ESM
        {
          entryFileNames: 'bundler.mjs',
          format: 'es',
          sourcemap: true,
          inlineSources: true
        },
        // UMD (unminified)
        {
          entryFileNames: 'peerjs.js',
          format: 'umd',
          name: 'PeerJS',
          sourcemap: true
        },
        // UMD (minified with esbuild)
        {
          entryFileNames: 'peerjs.min.js',
          format: 'umd',
          name: 'PeerJS',
          sourcemap: true,
          minify: true
        },
        // MsgPack ESM (minified)
        {
          entryFileNames: 'serializer.msgpack.mjs',
          format: 'es',
          sourcemap: true,
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