import path from 'path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');

  const appPort = Number(env.VITE_APP_PORT || 9092);

  if (!Number.isInteger(appPort) || appPort < 1 || appPort > 65535) {
    throw new Error(`Invalid VITE_APP_PORT: ${env.VITE_APP_PORT}`);
  }

  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),

        '@insurance-max/contracts': path.resolve(
          __dirname,
          '../../libs/contracts/src',
        ),

        '@insurance-max/portal-shared': path.resolve(
          __dirname,
          '../../libs/portal-shared/src',
        ),
      },
    },

    server: {
      host: '0.0.0.0',
      port: appPort,
      strictPort: true,
    },

    preview: {
      host: '0.0.0.0',
      port: appPort,
      strictPort: true,
    },

    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      pool: 'forks',
      execArgv: [
        `--localstorage-file=${path.resolve(
          __dirname,
          'node_modules/.vitest-localstorage',
        )}`,
      ],
    },
  };
});
