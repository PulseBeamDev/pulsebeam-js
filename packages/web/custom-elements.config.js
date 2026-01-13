export default {
    /** Globs to analyze */
    globs: ['src/components/*.ts'],
    /** Globs to exclude */
    exclude: ['src/components/index.ts'],
    /** Directory to output the manifest to */
    outdir: 'dist',
    /** Whether to run in dev mode, default is false */
    dev: false,
    /** Whether to run in watch mode, default is false */
    watch: false,
    /** Whether to include third party custom elements manifests */
    dependencies: true,
    /** Output the manifest as a JSON file */
    packageJson: true,
    /** Package name */
    packageName: '@pulsebeam/web',
    /** Lit plugin */
    litelement: true,
};
