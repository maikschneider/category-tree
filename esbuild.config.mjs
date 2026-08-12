import esbuild from 'esbuild';

const buildConfig = {
    entryPoints: [
        'Resources/Private/TypeScript/category-tree-element.ts',
    ],
    mainFields: ['browser', 'module', 'main'],
    conditions: ['browser'],
    bundle: true,
    outdir: 'Resources/Public/JavaScript/',
    format: 'esm',
    logLevel: 'info',
    sourcemap: false,
    // Everything the TYPO3 backend already provides through its import map.
    external: ['@typo3/*', 'lit', 'lit/*', 'lit-html', 'lit-html/*', 'lit-element', 'lit-element/*', '@lit/*'],
};

if (process.argv.includes('--build')) {
    await esbuild.build({ ...buildConfig, minify: true });
} else {
    const ctx = await esbuild.context(buildConfig);
    await ctx.watch();
}
