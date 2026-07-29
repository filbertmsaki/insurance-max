import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const appPort = Number(env.VITE_APP_PORT || 9092);

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@insurance-max/portal-shared': path.resolve(
          __dirname,
          '../../libs/portal-shared/src',
        ),
      },
    },
    server: {
      host: '0.0.0.0',
      port: appPort,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      // Node 22+ ships a native `localStorage` global that is `undefined`
      // unless a backing file is provided, which otherwise shadows jsdom's
      // own window.localStorage and breaks anything using the bare
      // `localStorage` global (e.g. zustand's `persist` middleware).
      pool: 'forks',
      execArgv: [
        `--localstorage-file=${path.resolve(__dirname, 'node_modules/.vitest-localstorage')}`,
      ],
    },
  };
});
