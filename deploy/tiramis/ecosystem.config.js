module.exports = {
  apps: [
    {
      name: 'tiramis',

      script: 'dist/apps/tiramis/apps/tiramis/src/main.js',
      cwd: '/opt/apps/tiramis/current',

      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      watch: false,

      max_memory_restart: '750M',
      restart_delay: 3000,
      kill_timeout: 15000,
      listen_timeout: 15000,
      wait_ready: false,

      env_file: '/opt/apps/tiramis/shared/.env',

      env: {
        NODE_ENV: 'production',
        APP_ENV: 'production',
        APP_HOST: '127.0.0.1',
        APP_PORT: '9090',
      },

      out_file: '/var/log/pm2/tiramis-out.log',
      error_file: '/var/log/pm2/tiramis-error.log',
      pid_file: '/var/run/tiramis.pid',

      merge_logs: true,
      time: true,
    },
  ],
};