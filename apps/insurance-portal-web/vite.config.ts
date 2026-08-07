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

    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');

            if (normalizedId.includes('node_modules')) {
              if (
                normalizedId.includes('/react/') ||
                normalizedId.includes('/react-dom/') ||
                normalizedId.includes('/react-router-dom/')
              ) {
                return 'vendor-react';
              }

              if (
                normalizedId.includes('/@tanstack/react-query/') ||
                normalizedId.includes('/axios/')
              ) {
                return 'vendor-data';
              }

              if (
                normalizedId.includes('/@radix-ui/') ||
                normalizedId.includes('/lucide-react/') ||
                normalizedId.includes('/sonner/')
              ) {
                return 'vendor-ui';
              }

              if (
                normalizedId.includes('/react-hook-form/') ||
                normalizedId.includes('/@hookform/resolvers/') ||
                normalizedId.includes('/zod/')
              ) {
                return 'vendor-forms';
              }

              return 'vendor-misc';
            }

            if (normalizedId.includes('/src/modules/tenant/finance/')) {
              return 'feature-finance';
            }

            if (
              normalizedId.includes('/src/modules/tenant/tiramis/') ||
              normalizedId.includes('/src/modules/tenant/verifications/')
            ) {
              return 'feature-tiramis';
            }

            if (normalizedId.includes('/src/modules/tenant/product-engine/')) {
              return 'feature-product-engine';
            }

            if (normalizedId.includes('/src/modules/tenant/motor/')) {
              return 'feature-motor';
            }

            if (
              normalizedId.includes('/src/modules/tenant/quotations/') ||
              normalizedId.includes('/src/modules/tenant/policies/') ||
              normalizedId.includes('/src/modules/tenant/customers/')
            ) {
              return 'feature-underwriting-core';
            }

            if (
              normalizedId.includes('/src/modules/tenant/analytics/') ||
              normalizedId.includes('/src/modules/tenant/reporting/') ||
              normalizedId.includes('/src/modules/tenant/regulatory/') ||
              normalizedId.includes('/src/modules/tenant/phase16/')
            ) {
              return 'feature-phase16';
            }

            if (normalizedId.includes('/src/modules/platform/')) {
              return 'feature-platform-admin';
            }

            if (normalizedId.includes('/src/modules/shared/auth/')) {
              return 'feature-auth';
            }

            if (
              normalizedId.includes('/src/modules/shared/devices/') ||
              normalizedId.includes('/src/modules/shared/sessions/') ||
              normalizedId.includes('/src/modules/shared/profile/')
            ) {
              return 'feature-user-settings';
            }

            return undefined;
          },
        },
      },
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
