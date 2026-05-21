const esbuild = require('esbuild');
const { execSync } = require('child_process');
const fs = require('fs');

// Generate type definitions
execSync('tsc --emitDeclarationOnly', { stdio: 'inherit' });

// Custom CSS loader
const cssPlugin = {
  name: 'css-loader',
  setup(build) {
    build.onLoad({ filter: /\.css$/ }, async (args) => {
      const css = fs.readFileSync(args.path, 'utf8');
      // Escape special characters
      const escaped = css
        .replace(/\\/g, '\\\\')
        .replace(/`/g, '\\`')
        .replace(/\$/g, '\\$');
      
      return {
        contents: `
const css = \`${escaped}\`;
const style = document.createElement('style');
style.textContent = css;
document.head.appendChild(style);
export default css;
`,
        loader: 'js',
      };
    });
  },
};

// Bundle JavaScript with CSS
esbuild.build({
  entryPoints: ['src/index.ts'],
  outdir: 'dist',
  bundle: true,
  splitting: false,
  format: 'esm',
  platform: 'browser',
  target: 'esnext',
  sourcemap: true,
  external: ['maplibre-gl'], // Keep maplibre-gl as external dependency
  plugins: [cssPlugin]
}).catch(() => process.exit(1));
