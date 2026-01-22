export default {
  /** Globs to analyze */
  globs: ['src/**/*.ts'],
  /** Globs to exclude */
  exclude: ['src/**/*.d.ts', 'src/vite-env.d.ts'],
  /** Directory to output the manifest to */
  outdir: 'dist',
  /** Whether to run in dev mode, default is false */
  dev: false,
  /** Whether to run in watch mode, default is false */
  watch: false,
  /** Whether to include third party custom elements manifests */
  dependencies: false,
  /** Output the manifest as a JSON file */
  packageJson: true,
  /** Package name */
  packageName: '@pulsebeam/web',
  /** Lit plugin */
  litelement: true,
  /** Override TypeScript configuration for analysis */
  overrideTsConfig: (config) => ({
    ...config,
    compilerOptions: {
      ...config.compilerOptions,
      moduleResolution: 'node',
      allowJs: true,
    },
  }),
};
