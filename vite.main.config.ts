import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    conditions: ['node'],
  },
  plugins: [
    {
      name: 'externalize-native-modules',
      resolveId(source) {
        // Externalize @lydell/node-pty and all its platform-specific packages
        if (source === '@lydell/node-pty' || source.startsWith('@lydell/node-pty-')) {
          return { id: source, external: true };
        }
        return null;
      },
    },
  ],
  build: {
    sourcemap: process.env.NODE_ENV === 'development',
    rollupOptions: {
      external: [/^@lydell\/node-pty/],
    },
  },
});
