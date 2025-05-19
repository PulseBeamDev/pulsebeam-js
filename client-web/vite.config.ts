import { defineConfig } from "vite";
import path from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    dts({
      insertTypesEntry: true,
      outDir: "dist/types",
      tsconfigPath: "./tsconfig.json",
    }),
  ],
  build: {
    // Output directory for the built library
    outDir: "dist",
    // Minify the output
    minify: true, // 'esbuild' or true for terser, false to disable
    // Generate source maps
    sourcemap: true,
    lib: {
      // The entry point for your library (exports all components)
      entry: path.resolve(__dirname, "src/index.ts"),
      // The name for the UMD build (if you're creating one)
      name: "Pulsebeam",
      // Output formats
      formats: ["es", "umd"],
      // Filename for the generated bundle (without extension)
      // The [format] placeholder will be replaced by 'es', 'cjs', or 'umd'
      fileName: (format) => `pulsebeam.${format}.js`,
    },
    // rollupOptions: {
    //   // Make sure to externalize dependencies that shouldn't be bundled
    //   // into your library (Lit itself should be a peer dependency)
    //   external: ["lit", /^lit\/.*/],
    //   output: {
    //     // Provide global variables to use in the UMD build
    //     // for externalized deps
    //     globals: {
    //       "lit": "Lit",
    //       "lit/decorators.js": "LitDecorators", // Adjust if you import directly
    //       "lit/html.js": "LitHtml", // Adjust
    //       // Add other lit direct imports if you use them, e.g. 'lit/directives/class-map.js'
    //     },
    //     // If you want to export CSS separately (Less common for Lit components with Shadow DOM)
    //     // assetFileNames: (assetInfo) => {
    //     //   if (assetInfo.name === 'style.css') return 'my-lit-library.css';
    //     //   return assetInfo.name;
    //     // },
    //   },
    // },
  },
});
