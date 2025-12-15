const esbuild = require('esbuild');

async function build() {
  try {
    await esbuild.build({
      entryPoints: ['src/SessionStore.node.ts'],
      bundle: true,
      platform: 'node',
      // outfile: 'dist/SessionStore.node.js',
      outdir: 'dist',
      // n8n nodes need to keep their class names for some checks, though usually fine.
      // We exclude n8n-workflow from the bundle as it's provided by the host
      external: ['n8n-workflow'],
      sourcemap: true,
      minify: false,
    });
    console.log('Build successful!');
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
