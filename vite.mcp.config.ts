import { defineConfig } from 'vite';
import { builtinModules } from 'node:module';

/**
 * Builds the standalone MCP server into dist-mcp/server.js.
 * This file runs outside Electron (plain Node.js via `node server.js`),
 * so all npm dependencies are bundled in and Node builtins are kept external.
 */

// All Node.js builtin modules, both bare and with node: prefix
const nodeBuiltins = builtinModules.flatMap((m) => [m, `node:${m}`]);

export default defineConfig({
  build: {
    lib: {
      entry: 'src/main/mcp/server.ts',
      formats: ['cjs'],
      fileName: () => 'server.js',
    },
    outDir: 'dist-mcp',
    emptyDirBeforeWrite: true,
    target: 'node18',
    minify: false,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    rollupOptions: {
      external: nodeBuiltins,
    },
  },
  resolve: {
    conditions: ['node', 'import', 'module', 'default'],
  },
  // Prevent Vite from trying to polyfill/externalize Node globals
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
});
